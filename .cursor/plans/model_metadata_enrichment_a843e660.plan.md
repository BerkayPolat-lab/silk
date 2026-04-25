---
name: Model Metadata Enrichment
overview: Add reliable throughput/latency/context metadata to `models` using API-first ingestion with validated fallbacks, then update Supabase through MCP after build approval.
todos:
  - id: confirm-sources
    content: Finalize exact API endpoints for TTFT and throughput and define normalization rules for model IDs.
    status: completed
  - id: schema-migration
    content: Prepare migration SQL for new performance columns and provenance metadata on `public.models`.
    status: completed
  - id: enrichment-script
    content: Implement API-first enrichment script with dry-run, matching tiers, and fallback static dataset.
    status: completed
  - id: mcp-update
    content: Run migration + data update via Supabase MCP after build approval, then verify coverage and spot-check data quality.
    status: completed
  - id: ui-wireup
    content: Update model search and compare panels with new selects, filter controls, and compare rows for performance fields.
    status: completed
isProject: false
---

# Model Metadata Enrichment Plan

## Goal
Enrich Supabase `models` rows with runtime-oriented metadata to improve compare/filter features:
- Throughput (output tokens/sec)
- Latency (TTFT in ms)
- Context length (tokens)
- Model size (GB)

## Current State (researched)
- UI already queries `models` for `gb_size` and other metadata in [ModelSearch.tsx](/Users/berkaypolat/Desktop/silk/components/ModelSearch.tsx) and [CompareModelsPanel.tsx](/Users/berkaypolat/Desktop/silk/components/CompareModelsPanel.tsx).
- `public.models` currently has `gb_size` but does **not** have structured `throughput`, `latency`, or `context_length` columns.
- Existing model catalog is mostly seeded via static SQL migrations in [supabase/migrations](/Users/berkaypolat/Desktop/silk/supabase/migrations).

## Chosen Strategy
- **Primary source:** API-first.
- **Metric definition:** provider runtime metrics (TTFT + output tokens/sec).

## Data Source Plan
1. **Context length source (high confidence):** OpenRouter Models API (`/api/v1/models`) for `context_length` mapped by `litellm_model_id`/model slug.
2. **Latency + throughput source (runtime benchmarks):** benchmark API source(s) with machine-readable output (e.g., Metrik TTFT API and/or equivalent throughput source).
3. **Fallback source:** curated static JSON in-repo for missing models/fields, with explicit provenance.
4. **Trust model:** store a per-field `source` and `last_verified_at` so filters can prefer fresher data.

## Database & Schema Plan
1. Add columns on `public.models`:
   - `context_length_tokens bigint`
   - `latency_ttft_ms integer`
   - `throughput_tokens_per_sec numeric`
   - (retain existing `gb_size`, but backfill/normalize)
2. Add optional provenance columns (explicitly requested):
   - `perf_source text`
   - `perf_updated_at timestamptz`
3. Add lightweight constraints (`>= 0`) and nullable defaults for partial coverage.
4. Missing-data policy:
   - Keep performance/spec fields nullable and numeric in DB.
   - Represent missing values as `"unknown"` at render time in the app.

## Ingestion & Mapping Plan
1. Build a repeatable enrichment script (server-side utility) that:
   - Reads current models (`id`, `slug`, `litellm_model_id`, `name`).
   - Fetches API metadata from selected sources.
   - Normalizes model IDs (strip suffixes like `:free`, provider aliases).
   - Produces a deterministic upsert/update payload.
2. Implement matching tiers:
   - Exact `litellm_model_id`
   - Normalized ID
   - Slug/name fallback map
3. Add dry-run mode to report:
   - matched vs unmatched models
   - changed fields per row
   - source freshness

## Supabase MCP Execution Plan (when you allow build)
1. Create schema migration SQL for new columns.
2. Run migration against your Supabase project via MCP (`execute_sql`/migration flow).
3. Execute enrichment script and push updates to `public.models`.
4. Validate with SQL checks:
   - coverage counts per field
   - null/missing rows
   - outlier detection (negative/absurd values)
5. Re-run UI queries and verify compare/filter behavior with new fields.

## App Integration Plan
1. Extend model selects/types in [ModelSearch.tsx](/Users/berkaypolat/Desktop/silk/components/ModelSearch.tsx) and [CompareModelsPanel.tsx](/Users/berkaypolat/Desktop/silk/components/CompareModelsPanel.tsx):
   - Include `context_length_tokens`, `latency_ttft_ms`, `throughput_tokens_per_sec`, `perf_source`, `perf_updated_at`.
   - Keep fields nullable so existing rows render safely during phased backfill.
2. Update `ModelSearch` filter state and controls:
   - Add `maxLatencyMs` (ceiling), `minThroughputTps` (floor), `minContextLength` (floor).
   - Add segmented/select controls consistent with existing filter UI style.
   - Apply `.lte("latency_ttft_ms", ...)`, `.gte("throughput_tokens_per_sec", ...)`, and `.gte("context_length_tokens", ...)` in query builder.
   - Include clear/reset behavior and active-filter count updates for new controls.
3. Update compare panel rows in `CompareModelsPanel`:
   - Add **Latency (TTFT)** row with `lower`-is-better highlighting.
   - Add **Throughput (tok/s)** row with `higher`-is-better highlighting.
   - Add **Context length** row with `higher`-is-better highlighting.
   - Format missing/null values as `"unknown"`; format context as compact tokens (e.g., `128k`) and latency with `ms`.
4. Provenance display in comparison/search cards (lightweight):
   - Surface `perf_source` + `perf_updated_at` as subtle helper text/tooltip where performance metrics are shown.
   - Hide when missing to avoid noisy UI.
5. Guardrails for partial data:
   - Keep rows hidden when both compared values are missing.
   - Ensure filters do not exclude null-valued models unless that specific filter is active.
   - Use a single formatter shared by search and compare so missing values always render as `"unknown"`.

## Validation & Safety
- Verify API payloads and mapping quality before writing.
- Keep writes idempotent (update only changed values).
- Log unmatched models for manual curation.
- Preserve existing data if external sources are temporarily unavailable.
