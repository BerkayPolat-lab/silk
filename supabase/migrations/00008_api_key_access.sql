-- ============================================================
-- Migration 00008: API Key-Based Model Access
-- ============================================================
-- "Ordering" a model = user submits their own provider API key.
-- No money involved. Access is granted per provider, not per model.
--
-- Changes:
--   1. user_api_keys.provider_id       — ties a key to a specific provider
--   2. UNIQUE(user_id, provider_id)    — one key per provider per user
--   3. api_usage.last_used_at          — updated on every sandbox call
--   4. api_usage.request_count         — incremented on every sandbox call
--   5. increment_usage_count() RPC     — atomic upsert called by sandbox route
--
-- NOTE: Do NOT apply the earlier 00007_cart_and_purchases.sql we drafted.
-- This migration supersedes it. If you already applied that file, run:
--   ALTER TABLE models DROP COLUMN IF EXISTS price_cents;
--   DROP TABLE IF EXISTS purchases CASCADE;
-- before running this one.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add provider_id to user_api_keys
-- ------------------------------------------------------------
ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE CASCADE;

-- One key per provider per user.
-- Partial index so NULL provider_id rows (legacy platform keys) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_user_provider_unique
  ON user_api_keys (user_id, provider_id)
  WHERE provider_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Enrich api_usage for dashboard metrics
-- ------------------------------------------------------------
ALTER TABLE api_usage
  ADD COLUMN IF NOT EXISTS last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS request_count INTEGER     NOT NULL DEFAULT 1;

-- Backfill: seed last_used_at from first_used_at for any pre-existing rows.
UPDATE api_usage
SET last_used_at = first_used_at
WHERE last_used_at = now()
  AND first_used_at < now();

-- ------------------------------------------------------------
-- 3. RPC: atomic usage increment (called fire-and-forget by sandbox route)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_usage_count(
  p_user_id  UUID,
  p_model_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as owner so it can bypass RLS for this write
AS $$
BEGIN
  INSERT INTO api_usage (user_id, model_id, api_key_id, first_used_at, last_used_at, request_count)
  VALUES (p_user_id, p_model_id, NULL, now(), now(), 1)
  ON CONFLICT (user_id, model_id, api_key_id)
  DO UPDATE SET
    last_used_at  = now(),
    request_count = api_usage.request_count + 1;
END;
$$;
