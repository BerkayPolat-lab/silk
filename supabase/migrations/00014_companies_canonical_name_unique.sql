-- Ensure deterministic company upserts by canonicalized company name.
CREATE UNIQUE INDEX IF NOT EXISTS companies_canonical_name_unique_idx
ON public.companies ((lower(btrim(name))));
