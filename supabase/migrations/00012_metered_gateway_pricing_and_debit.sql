-- Model pricing (cents per 1M tokens) + atomic wallet debit + usage ledger row

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS input_price_per_million_cents BIGINT NOT NULL DEFAULT 0
    CHECK (input_price_per_million_cents >= 0);

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS output_price_per_million_cents BIGINT NOT NULL DEFAULT 0
    CHECK (output_price_per_million_cents >= 0);

CREATE OR REPLACE FUNCTION debit_usage_and_log(
  p_user_id UUID,
  p_model_id UUID,
  p_api_key_id UUID,
  p_prompt_tokens INTEGER,
  p_completion_tokens INTEGER,
  p_cost_cents BIGINT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cost_i INTEGER;
BEGIN
  IF p_prompt_tokens < 0 OR p_completion_tokens < 0 OR p_cost_cents < 0 THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM models WHERE id = p_model_id) THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_api_keys
    WHERE id = p_api_key_id AND user_id = p_user_id AND key_type = 'platform'
  ) THEN
    RETURN FALSE;
  END IF;

  cost_i := LEAST(p_cost_cents, 2147483647)::INTEGER;

  UPDATE user_wallets
  SET balance_cents = balance_cents - p_cost_cents,
      updated_at = now()
  WHERE user_id = p_user_id
    AND balance_cents >= p_cost_cents;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO api_usage_events (
    user_id,
    model_id,
    api_key_id,
    prompt_tokens,
    completion_tokens,
    cost_cents,
    source
  ) VALUES (
    p_user_id,
    p_model_id,
    p_api_key_id,
    p_prompt_tokens,
    p_completion_tokens,
    cost_i,
    'live'
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION debit_usage_and_log(
  UUID, UUID, UUID, INTEGER, INTEGER, BIGINT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION debit_usage_and_log(
  UUID, UUID, UUID, INTEGER, INTEGER, BIGINT
) TO service_role;
