-- Selected rows should have both metrics.
SELECT slug, latency_ttft_ms, throughput_tokens_per_sec
FROM public.models
WHERE slug IN ('gpt-5-5-pro', 'gpt-5-5', 'deepseek-v4-pro', 'deepseek-v4-flash', 'gpt-5-4-image-2')
  AND (latency_ttft_ms IS NULL OR throughput_tokens_per_sec IS NULL);

-- Duplicate checks.
SELECT slug, count(*) AS duplicate_count
FROM public.models
GROUP BY slug
HAVING count(*) > 1;

SELECT lower(btrim(name)) AS canonical_company_name, count(*) AS duplicate_count
FROM public.companies
GROUP BY lower(btrim(name))
HAVING count(*) > 1;

-- Orphan checks.
SELECT m.id, m.slug
FROM public.models m
LEFT JOIN public.providers p ON p.id = m.provider_id
WHERE p.id IS NULL;

SELECT p.id, p.slug
FROM public.providers p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE c.id IS NULL;