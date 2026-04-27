---
name: Supabase LLM Catalog Expansion
overview: Expand the Supabase model catalog by ingesting OpenRouter models that can be matched to inferencelatency data with both latency and throughput present, then upsert into companies/providers/models while filling metadata fields and provenance.
todos:
  - id: extend-fetch-and-match
    content: Extend enrichment script to produce eligible OpenRouter model rows matched to inferencelatency with both latency and throughput.
    status: completed
  - id: add-company-provider-mapping
    content: Add canonical company/provider metadata mapping with website and logo_url defaults plus safe fallbacks.
    status: completed
  - id: generate-idempotent-upserts
    content: Generate transactional idempotent SQL for companies, providers, and models with conflict updates.
    status: completed
  - id: schema-hardening
    content: Add migration to enforce deterministic company conflict target (unique company key).
    status: completed
  - id: validate-coverage
    content: Add post-run JSON and SQL verification checks for coverage, integrity, and duplicates.
    status: completed
  - id: dedupe-and-cleanup
    content: Add deterministic deduplication/cleanup SQL to merge or remove duplicate and inconsistent rows safely.
    status: completed
isProject: false
---

# Supabase LLM Catalog Expansion Plan

## Scope and decisions
- Insert/update `companies`, `providers`, and `models` in Supabase.
- Include only models with **both** metrics available (`latency_ttft_ms` and `throughput_tokens_per_sec`).
- Use **upsert + enrichment** for existing rows (do not skip existing slugs).
- **Testing phase:** limit write payload to **5 eligible models** for initial pipeline validation.
- Prioritize candidates mapped to **existing** `providers` and `companies` in DB before introducing new provider/company rows.

## Existing code to extend
- Current script [`/Users/berkaypolat/Desktop/silk/scripts/model-metadata/enrich-model-metadata.mjs`](/Users/berkaypolat/Desktop/silk/scripts/model-metadata/enrich-model-metadata.mjs) already:
  - fetches OpenRouter + inferencelatency/Metrik
  - normalizes provider/model keys
  - outputs model metadata `UPDATE` SQL for existing `models`
- Current schema/migrations:
  - table definitions: [`/Users/berkaypolat/Desktop/silk/supabase/migrations/00002_create_tables.sql`](/Users/berkaypolat/Desktop/silk/supabase/migrations/00002_create_tables.sql)
  - existing seed strategy: [`/Users/berkaypolat/Desktop/silk/supabase/migrations/00003_seed_data.sql`](/Users/berkaypolat/Desktop/silk/supabase/migrations/00003_seed_data.sql)
  - perf fields on `models`: [`/Users/berkaypolat/Desktop/silk/supabase/migrations/00013_model_performance_metadata.sql`](/Users/berkaypolat/Desktop/silk/supabase/migrations/00013_model_performance_metadata.sql)

## Data pipeline design
1. **Fetch and normalize source datasets**
- OpenRouter models endpoint for catalog/spec fields (`id`, name, context length, pricing, description where available).
- inferencelatency dataset for throughput/latency; retain only records with both non-null metrics.
- Reuse/extend current normalization helpers for provider aliases and model ID canonicalization.

2. **Build model eligibility set**
- Start from OpenRouter models.
- Match each model to inferencelatency via existing lookup tiers (normalized `litellm_model_id`, model slug/name variants, provider+model composite keys).
- Keep only rows where both metrics exist after matching.
- For the first test run, select only 5 rows after ranking by **highest non-null field coverage** across enrichment fields.
- Suggested completeness score fields: `description`, `context_length_tokens`, `latency_ttft_ms`, `throughput_tokens_per_sec`, `api_docs`, `website`, `logo_url`, `litellm_model_id`, `perf_source`.
- Apply ranking in two buckets:
  - Bucket A (primary): rows whose normalized provider/company already exist in DB.
  - Bucket B (secondary): remaining eligible rows requiring new provider/company inserts.
- Fill 5-model test quota from Bucket A first; use Bucket B only if Bucket A has fewer than 5 rows.

3. **Derive company/provider/model payloads**
- `companies`: canonical company name, `website`, `logo_url`.
- `providers`: canonical provider `slug`, provider display `name`, `company_id` mapping.
- `models`: required fields (`provider_id`, `name`, `slug`) plus best-effort fill for:
  - `description`, `litellm_model_id`, `context_length_tokens`, `latency_ttft_ms`, `throughput_tokens_per_sec`, `perf_source`, `perf_updated_at`, `api_docs`.
- Rank ordering: preserve existing `rank_order` when present; append new rows after current max rank.

4. **Website/logo enrichment strategy**
- Primary: deterministic provider/company map in script for known providers (OpenAI, Anthropic, Google, xAI, Mistral, etc.).
- Secondary: fallback from OpenRouter metadata fields (if present).
- Keep `logo_url` nullable if no trustworthy URL is found; do not invent guessed image paths.

## Database write strategy (idempotent)
1. **Pre-step migration hardening**
- Add unique constraint/index on `companies.name` (or `companies.slug` if introduced) so company upsert is deterministic.
- Keep existing unique constraints on `providers.slug` and `models.slug` as conflict targets.

2. **Transactional upsert SQL generation**
- Extend script to emit a single SQL file with CTEs/transaction in this order:
  - upsert companies (`ON CONFLICT ... DO UPDATE`)
  - upsert providers (join to resolved company IDs)
  - upsert models (join to resolved provider IDs)
- Model upsert updates enrichment fields on conflict, including metrics and links, while preserving non-null existing values when incoming value is null.

3. **Execution path**
- Keep current workflow of generating output artifacts under `tmp/`.
- Run generated SQL via Supabase (MCP `execute_sql` or project migration/query workflow) only after review.
- Add script flag (e.g. `--limit 5`) and set default test invocation to cap upserts to 5 models.

## Deduplication and cleanup rules
1. **Canonical identity keys**
- `companies`: canonicalized `name` (lowercase + trimmed) as dedupe key.
- `providers`: canonicalized `slug` as dedupe key.
- `models`: canonicalized `slug` as primary dedupe key, with `litellm_model_id` as secondary collision signal.

2. **Deterministic keep/merge policy**
- For duplicate groups, keep one canonical row chosen by:
  - row with both metrics present
  - then row with non-null `litellm_model_id`
  - then earliest `created_at` (stable tie-breaker).
- Merge non-null fields from discarded rows into the kept row only when kept value is null (`description`, `api_docs`, `logo_url`, `website`, perf fields).
- Repoint foreign keys before delete:
  - duplicate `providers.company_id` -> kept company
  - duplicate `models.provider_id` -> kept provider
  - dependent `reviews`/`api_usage`/other FK rows -> kept model.

3. **Incorrect/inconsistent row removal policy**
- Delete rows that are provably invalid after merge/repoint:
  - duplicate rows that have been superseded
  - `models` rows with missing required linkage (`provider_id` unresolved)
  - `models` rows with malformed critical identity (`slug` empty/invalid after normalization).
- Do not delete rows solely due to optional null fields (`logo_url`, `website`, `api_docs`, `description`).
- Do not overwrite trusted existing values with lower-confidence source values.

## Validation and quality checks
- Emit `tmp/model-catalog-upserts.json` with:
  - total candidates, eligible-by-metrics count, inserted/updated counts by table, unmatched rows.
  - `selected_for_write_count` (expected `5` in testing phase) and selected model IDs/slugs.
  - per-selected-row completeness score and non-null field list used for ranking.
  - per-selected-row `existing_provider_company_match` flag and bucket (`A`/`B`) for auditability.
- Add SQL verification queries:
  - null-rate for `latency_ttft_ms`/`throughput_tokens_per_sec` among newly touched models (should be 0 by eligibility rule)
  - orphan checks for `provider_id`/`company_id`
  - duplicate checks by `slug` and company canonical key.
  - pre/post cleanup row counts and deleted-row audit by reason.
- Spot-check top providers and a random sample of new models for correct website/logo fields.

## Safety and rollback
- Use a DB transaction for all three table writes.
- Write only deterministic, reproducible SQL from fetched snapshot data.
- Keep a dry-run mode that performs fetch/match/report without producing write SQL.