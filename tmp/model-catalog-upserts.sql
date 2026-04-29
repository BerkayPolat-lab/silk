BEGIN;

WITH input_rows (
  company_name, website, logo_url, provider_name, provider_slug, model_name, model_slug, description,
  api_docs, litellm_model_id, context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, perf_source, perf_updated_at
) AS (
  VALUES
(
  'Anthropic'::text,
  'https://anthropic.com'::text,
  'https://anthropic.com/favicon.ico'::text,
  'anthropic'::text,
  'anthropic'::text,
  'Anthropic Claude Haiku Latest'::text,
  'claude-haiku-latest'::text,
  'This model always redirects to the latest model in the Anthropic Claude Haiku family.'::text,
  'https://docs.anthropic.com'::text,
  '~anthropic/claude-haiku-latest'::text,
  200000::bigint,
  2007::integer,
  14.45::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'OpenAI'::text,
  'https://openai.com'::text,
  'https://openai.com/favicon.ico'::text,
  'openai'::text,
  'openai'::text,
  'OpenAI GPT Mini Latest'::text,
  'gpt-mini-latest'::text,
  'This model always redirects to the latest model in the OpenAI GPT Mini family.'::text,
  'https://platform.openai.com/docs'::text,
  '~openai/gpt-mini-latest'::text,
  400000::bigint,
  1997::integer,
  9.01::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'Anthropic'::text,
  'https://anthropic.com'::text,
  'https://anthropic.com/favicon.ico'::text,
  'anthropic'::text,
  'anthropic'::text,
  'Anthropic Claude Sonnet Latest'::text,
  'claude-sonnet-latest'::text,
  'This model always redirects to the latest model in the Anthropic Claude Sonnet family.'::text,
  'https://docs.anthropic.com'::text,
  '~anthropic/claude-sonnet-latest'::text,
  1000000::bigint,
  2007::integer,
  14.45::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'OpenAI'::text,
  'https://openai.com'::text,
  'https://openai.com/favicon.ico'::text,
  'openai'::text,
  'openai'::text,
  'OpenAI GPT Latest'::text,
  'gpt-latest'::text,
  'This model always redirects to the latest model in the OpenAI GPT family.'::text,
  'https://platform.openai.com/docs'::text,
  '~openai/gpt-latest'::text,
  1050000::bigint,
  1997::integer,
  9.01::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'OpenAI'::text,
  'https://openai.com'::text,
  'https://openai.com/favicon.ico'::text,
  'openai'::text,
  'openai'::text,
  'OpenAI: GPT-5.5 Pro'::text,
  'gpt-5-5-pro'::text,
  'GPT-5.5 Pro is OpenAI’s high-capability model optimized for deep reasoning and accuracy on complex, high-stakes workloads. It features a 1M+ token context window (922K input, 128K output) with support for...'::text,
  'https://platform.openai.com/docs'::text,
  'openai/gpt-5.5-pro'::text,
  1050000::bigint,
  1997::integer,
  9.01::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'OpenAI'::text,
  'https://openai.com'::text,
  'https://openai.com/favicon.ico'::text,
  'openai'::text,
  'openai'::text,
  'OpenAI: GPT-5.5'::text,
  'gpt-5-5'::text,
  'GPT-5.5 is OpenAI’s frontier model designed for complex professional workloads, building on GPT-5.4 with stronger reasoning, higher reliability, and improved token efficiency on hard tasks. It features a 1M+ token...'::text,
  'https://platform.openai.com/docs'::text,
  'openai/gpt-5.5'::text,
  1050000::bigint,
  1997::integer,
  9.01::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'DeepSeek'::text,
  'https://deepseek.com'::text,
  'https://deepseek.com/favicon.ico'::text,
  'deepseek'::text,
  'deepseek'::text,
  'DeepSeek: DeepSeek V4 Pro'::text,
  'deepseek-v4-pro'::text,
  'DeepSeek V4 Pro is a large-scale Mixture-of-Experts model from DeepSeek with 1.6T total parameters and 49B activated parameters, supporting a 1M-token context window. It is designed for advanced reasoning, coding,...'::text,
  'https://platform.deepseek.com/api-docs'::text,
  'deepseek/deepseek-v4-pro'::text,
  1048576::bigint,
  924::integer,
  12.98::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'DeepSeek'::text,
  'https://deepseek.com'::text,
  'https://deepseek.com/favicon.ico'::text,
  'deepseek'::text,
  'deepseek'::text,
  'DeepSeek: DeepSeek V4 Flash'::text,
  'deepseek-v4-flash'::text,
  'DeepSeek V4 Flash is an efficiency-optimized Mixture-of-Experts model from DeepSeek with 284B total parameters and 13B activated parameters, supporting a 1M-token context window. It is designed for fast inference and...'::text,
  'https://platform.deepseek.com/api-docs'::text,
  'deepseek/deepseek-v4-flash'::text,
  1048576::bigint,
  924::integer,
  12.98::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'OpenAI'::text,
  'https://openai.com'::text,
  'https://openai.com/favicon.ico'::text,
  'openai'::text,
  'openai'::text,
  'OpenAI: GPT-5.4 Image 2'::text,
  'gpt-5-4-image-2'::text,
  '[GPT-5.4](https://openrouter.ai/openai/gpt-5.4) Image 2 combines OpenAI''s GPT-5.4 model with state-of-the-art image generation capabilities from GPT Image 2. It enables rich multimodal workflows, allowing users to seamlessly move between reasoning, coding, and...'::text,
  'https://platform.openai.com/docs'::text,
  'openai/gpt-5.4-image-2'::text,
  272000::bigint,
  1997::integer,
  9.01::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
),
(
  'Anthropic'::text,
  'https://anthropic.com'::text,
  'https://anthropic.com/favicon.ico'::text,
  'anthropic'::text,
  'anthropic'::text,
  'Anthropic: Claude Opus Latest'::text,
  'claude-opus-latest'::text,
  'This model always redirects to the latest model in the Claude Opus family.'::text,
  'https://docs.anthropic.com'::text,
  '~anthropic/claude-opus-latest'::text,
  1000000::bigint,
  2007::integer,
  14.45::numeric,
  'openrouter+inferencelatency'::text,
  '2026-04-28T17:38:10.702Z'::timestamptz
)
),
upsert_companies AS (
  INSERT INTO public.companies (name, website, logo_url)
  SELECT DISTINCT company_name, website, logo_url
  FROM input_rows
  ON CONFLICT ((lower(btrim(name))))
  DO UPDATE SET
    website = COALESCE(EXCLUDED.website, public.companies.website),
    logo_url = COALESCE(EXCLUDED.logo_url, public.companies.logo_url)
  RETURNING id, name
),
companies_resolved AS (
  SELECT c.id, c.name
  FROM public.companies c
  WHERE lower(btrim(c.name)) IN (SELECT lower(btrim(company_name)) FROM input_rows)
),
upsert_providers AS (
  INSERT INTO public.providers (company_id, name, slug)
  SELECT cr.id, ir.provider_name, ir.provider_slug
  FROM (SELECT DISTINCT company_name, provider_name, provider_slug FROM input_rows) ir
  JOIN companies_resolved cr ON lower(btrim(cr.name)) = lower(btrim(ir.company_name))
  ON CONFLICT (slug)
  DO UPDATE SET
    company_id = EXCLUDED.company_id,
    name = COALESCE(EXCLUDED.name, public.providers.name)
  RETURNING id, slug
),
providers_resolved AS (
  SELECT p.id, p.slug
  FROM public.providers p
  WHERE p.slug IN (SELECT provider_slug FROM input_rows)
)
INSERT INTO public.models (
  provider_id, name, slug, description, api_docs, litellm_model_id,
  context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, perf_source, perf_updated_at
)
SELECT
  pr.id, ir.model_name, ir.model_slug, ir.description, ir.api_docs, ir.litellm_model_id,
  ir.context_length_tokens, ir.latency_ttft_ms, ir.throughput_tokens_per_sec, ir.perf_source, ir.perf_updated_at
FROM input_rows ir
JOIN providers_resolved pr ON pr.slug = ir.provider_slug
ON CONFLICT (slug)
DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  name = COALESCE(EXCLUDED.name, public.models.name),
  description = COALESCE(EXCLUDED.description, public.models.description),
  api_docs = COALESCE(EXCLUDED.api_docs, public.models.api_docs),
  litellm_model_id = COALESCE(EXCLUDED.litellm_model_id, public.models.litellm_model_id),
  context_length_tokens = COALESCE(EXCLUDED.context_length_tokens, public.models.context_length_tokens),
  latency_ttft_ms = COALESCE(EXCLUDED.latency_ttft_ms, public.models.latency_ttft_ms),
  throughput_tokens_per_sec = COALESCE(EXCLUDED.throughput_tokens_per_sec, public.models.throughput_tokens_per_sec),
  perf_source = COALESCE(EXCLUDED.perf_source, public.models.perf_source),
  perf_updated_at = EXCLUDED.perf_updated_at;

-- Deduplicate companies by canonicalized name.
WITH ranked AS (
  SELECT id, lower(btrim(name)) AS canon_name, created_at,
         row_number() OVER (PARTITION BY lower(btrim(name)) ORDER BY created_at ASC, id ASC) AS rn,
         first_value(id) OVER (PARTITION BY lower(btrim(name)) ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.companies
),
dupes AS (
  SELECT id AS drop_id, keep_id
  FROM ranked
  WHERE rn > 1
),
repoint AS (
  UPDATE public.providers p
  SET company_id = d.keep_id
  FROM dupes d
  WHERE p.company_id = d.drop_id
)
DELETE FROM public.companies c USING dupes d WHERE c.id = d.drop_id;

-- Deduplicate providers by slug.
WITH ranked AS (
  SELECT id, slug, company_id, created_at,
         row_number() OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS rn,
         first_value(id) OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.providers
),
dupes AS (
  SELECT id AS drop_id, keep_id
  FROM ranked
  WHERE rn > 1
),
repoint_models AS (
  UPDATE public.models m
  SET provider_id = d.keep_id
  FROM dupes d
  WHERE m.provider_id = d.drop_id
)
DELETE FROM public.providers p USING dupes d WHERE p.id = d.drop_id;

-- Deduplicate models by slug with metadata-aware precedence.
WITH ranked AS (
  SELECT id, slug, created_at,
         (CASE WHEN latency_ttft_ms IS NOT NULL AND throughput_tokens_per_sec IS NOT NULL THEN 1 ELSE 0 END) AS has_metrics,
         (CASE WHEN litellm_model_id IS NOT NULL THEN 1 ELSE 0 END) AS has_litellm,
         row_number() OVER (
           PARTITION BY slug
           ORDER BY
             (CASE WHEN latency_ttft_ms IS NOT NULL AND throughput_tokens_per_sec IS NOT NULL THEN 1 ELSE 0 END) DESC,
             (CASE WHEN litellm_model_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
             created_at ASC,
             id ASC
         ) AS rn,
         first_value(id) OVER (
           PARTITION BY slug
           ORDER BY
             (CASE WHEN latency_ttft_ms IS NOT NULL AND throughput_tokens_per_sec IS NOT NULL THEN 1 ELSE 0 END) DESC,
             (CASE WHEN litellm_model_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
             created_at ASC,
             id ASC
         ) AS keep_id
  FROM public.models
),
dupes AS (
  SELECT id AS drop_id, keep_id
  FROM ranked
  WHERE rn > 1
),
merge_fields AS (
  UPDATE public.models keep_row
  SET
    description = COALESCE(keep_row.description, drop_row.description),
    api_docs = COALESCE(keep_row.api_docs, drop_row.api_docs),
    litellm_model_id = COALESCE(keep_row.litellm_model_id, drop_row.litellm_model_id),
    context_length_tokens = COALESCE(keep_row.context_length_tokens, drop_row.context_length_tokens),
    latency_ttft_ms = COALESCE(keep_row.latency_ttft_ms, drop_row.latency_ttft_ms),
    throughput_tokens_per_sec = COALESCE(keep_row.throughput_tokens_per_sec, drop_row.throughput_tokens_per_sec),
    perf_source = COALESCE(keep_row.perf_source, drop_row.perf_source),
    perf_updated_at = COALESCE(keep_row.perf_updated_at, drop_row.perf_updated_at)
  FROM dupes d
  JOIN public.models drop_row ON drop_row.id = d.drop_id
  WHERE keep_row.id = d.keep_id
),
repoint_reviews AS (
  UPDATE public.reviews r
  SET model_id = d.keep_id
  FROM dupes d
  WHERE r.model_id = d.drop_id
),
repoint_usage AS (
  UPDATE public.api_usage u
  SET model_id = d.keep_id
  FROM dupes d
  WHERE u.model_id = d.drop_id
)
DELETE FROM public.models m USING dupes d WHERE m.id = d.drop_id;

-- Remove malformed model slugs that became empty after normalization.
DELETE FROM public.models
WHERE slug IS NULL OR btrim(slug) = '';

COMMIT;

-- Existing row metadata updates for currently stored models.
WITH updates (id, context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, gb_size, perf_source, perf_updated_at) AS (
  VALUES
('c20f0d4c-fe67-4547-919b-6f0bc346619d'::uuid, 1048576::bigint, 924::integer, 12.98::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('ca0a9b90-7929-4944-b6d4-c8dee9ce5349'::uuid, 1000000::bigint, 2007::integer, 14.45::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('80ee2643-5290-4245-9d16-35895e56f296'::uuid, 272000::bigint, 1997::integer, 9.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('b35797b6-38c9-46f8-a029-76961cb10042'::uuid, 1050000::bigint, 1997::integer, 9.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('c7011eb2-bdb3-4a74-9761-18fd2a389e0f'::uuid, 1050000::bigint, 1997::integer, 9.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('43de855c-b3bb-4b69-9419-f815b236a0af'::uuid, 1048576::bigint, 924::integer, 12.98::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('26e817d6-be18-4303-85d3-ea2d28aea16f'::uuid, 196608::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('a339b6f5-0c0a-40c1-8464-d685368665e9'::uuid, 131072::bigint, 924::integer, 12.98::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('800ef2a6-82d4-4b68-9ecf-6866011662d4'::uuid, 1048576::bigint, 350::integer, 92.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('57cc4572-ca46-44d0-9be6-8d02511fe0b3'::uuid, 1000000::bigint, 2007::integer, 14.45::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('0aa28de3-bd5f-4a16-8442-e255fe8e5d19'::uuid, 262144::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('24d0ef04-9782-4136-bc8e-4538a863c1fa'::uuid, 1048576::bigint, 350::integer, 92.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('5deec5b7-6783-4651-acdd-718ec84fa3ef'::uuid, 262144::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('2bceaa85-6b35-4f80-88ff-4a3c41ba035c'::uuid, 2000000::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('a691e004-7656-4bec-86e3-ee85c8cd02cd'::uuid, 1048576::bigint, 350::integer, 92.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('16d55295-527a-473a-af71-cdca9d9f479f'::uuid, 202752::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('5a17b210-9bcb-4aa1-9490-685a02d18135'::uuid, 202752::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('c0f88fd3-2383-4944-b9ba-b0c33ec97092'::uuid, 262144::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('a2dc41ea-5d40-491a-9e36-8315924c2f03'::uuid, 262144::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('3b47ad69-4639-4c62-8084-6e7cd30b9ad0'::uuid, 1000000::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('f522eccb-7afd-4069-b95e-7413fa2e7803'::uuid, 1048576::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('d4184346-7f21-4214-835b-d02085fa927c'::uuid, 196608::bigint, NULL::integer, NULL::numeric, NULL::numeric, 'openrouter'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('93fbb80d-da94-481c-be13-7d2a3f735b66'::uuid, 1048576::bigint, 350::integer, 92.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('17dd0973-ac3f-4cbc-85b9-9dd179387dee'::uuid, 1048576::bigint, 350::integer, 92.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('83f3ac3e-e568-4ed2-892b-244ec8dcafee'::uuid, 1048576::bigint, 350::integer, 92.01::numeric, NULL::numeric, 'openrouter+inferencelatency'::text, '2026-04-28T17:38:10.703Z'::timestamptz),
('ddb0c66f-8d8f-46d9-b50d-7f97e84cf355'::uuid, 131072::bigint, 750::integer, 58::numeric, NULL::numeric, 'openrouter+inferencelatency+fallback:curated'::text, '2026-04-28T17:38:10.703Z'::timestamptz)
)
UPDATE public.models AS m
SET
  context_length_tokens = u.context_length_tokens,
  latency_ttft_ms = u.latency_ttft_ms,
  throughput_tokens_per_sec = u.throughput_tokens_per_sec,
  gb_size = COALESCE(u.gb_size, m.gb_size),
  perf_source = u.perf_source,
  perf_updated_at = u.perf_updated_at
FROM updates AS u
WHERE m.id = u.id;
