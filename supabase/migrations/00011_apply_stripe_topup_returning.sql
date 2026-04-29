-- More reliable idempotency check: use RETURNING instead of GET DIAGNOSTICS ROW_COUNT
-- (avoids edge cases with some drivers / poolers).

CREATE OR REPLACE FUNCTION apply_stripe_topup(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_checkout_session_id TEXT,
  p_payment_intent_id TEXT,
  p_currency TEXT DEFAULT 'usd'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO billing_transactions (
    user_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    amount_cents,
    currency
  )
  VALUES (
    p_user_id,
    p_checkout_session_id,
    p_payment_intent_id,
    p_amount_cents,
    COALESCE(NULLIF(trim(p_currency), ''), 'usd')
  )
  ON CONFLICT (stripe_checkout_session_id) DO NOTHING
  RETURNING id INTO new_id;

  IF new_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO user_wallets (user_id, balance_cents, updated_at)
  VALUES (p_user_id, p_amount_cents, now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance_cents = user_wallets.balance_cents + EXCLUDED.balance_cents,
    updated_at = now();

  RETURN true;
END;
$$;
