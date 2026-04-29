-- ============================================================
-- Migration 00009: user_api_keys.key_type + api_usage_events
-- Replaces aggregate api_usage with per-event ledger.
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_api_keys: key_type (platform vs legacy BYOK)
-- ------------------------------------------------------------
ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS key_type TEXT NOT NULL DEFAULT 'legacy'
    CHECK (key_type IN ('platform', 'legacy'));

-- Backfill: BYOK rows have provider_id; Silk platform keys do not.
UPDATE user_api_keys
SET key_type = CASE
  WHEN provider_id IS NOT NULL THEN 'legacy'
  ELSE 'platform'
END
WHERE key_type = 'legacy';

-- ------------------------------------------------------------
-- 2. api_usage_events: append-only usage ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES user_api_keys(id) ON DELETE SET NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  cost_cents INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'migrated_rollup')),
  rollup_request_count INTEGER CHECK (rollup_request_count IS NULL OR rollup_request_count >= 0),
  legacy_first_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_events_user_id_idx ON api_usage_events(user_id);
CREATE INDEX IF NOT EXISTS api_usage_events_user_model_idx ON api_usage_events(user_id, model_id);
CREATE INDEX IF NOT EXISTS api_usage_events_created_at_idx ON api_usage_events(created_at DESC);

COMMENT ON TABLE api_usage_events IS 'Per-request (or migrated summary) LLM usage; billing and analytics.';
COMMENT ON COLUMN api_usage_events.source IS 'live = normal event; migrated_rollup = data moved from dropped api_usage table.';
COMMENT ON COLUMN api_usage_events.rollup_request_count IS 'For migrated_rollup only: former api_usage.request_count; NULL for live rows (count as 1).';

-- ------------------------------------------------------------
-- 3. Migrate api_usage → api_usage_events (summary rows)
-- ------------------------------------------------------------
INSERT INTO api_usage_events (
  user_id,
  model_id,
  api_key_id,
  prompt_tokens,
  completion_tokens,
  cost_cents,
  source,
  rollup_request_count,
  legacy_first_used_at,
  created_at
)
SELECT
  u.user_id,
  u.model_id,
  u.api_key_id,
  0,
  0,
  0,
  'migrated_rollup',
  u.request_count,
  u.first_used_at,
  u.last_used_at
FROM api_usage u;

-- ------------------------------------------------------------
-- 4. Drop old aggregate table + RPC (no longer used)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS increment_usage_count(UUID, UUID);

DROP POLICY IF EXISTS "Users read own api_usage" ON api_usage;
DROP POLICY IF EXISTS "Service role full api_usage" ON api_usage;

DROP TABLE IF EXISTS api_usage;

-- ------------------------------------------------------------
-- 5. RLS on api_usage_events
-- ------------------------------------------------------------
ALTER TABLE api_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own api_usage_events"
  ON api_usage_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full api_usage_events"
  ON api_usage_events FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
