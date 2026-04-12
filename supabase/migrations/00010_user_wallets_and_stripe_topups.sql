-- Wallet balance + idempotent Stripe Checkout top-ups

CREATE TABLE IF NOT EXISTS user_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_transactions_user_id_idx ON billing_transactions(user_id);

-- Idempotent credit: one row per Checkout session; wallet increments only on first insert.
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
  inserted_count INTEGER;
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
  ON CONFLICT (stripe_checkout_session_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN
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

REVOKE ALL ON FUNCTION apply_stripe_topup(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_stripe_topup(UUID, INTEGER, TEXT, TEXT, TEXT) TO service_role;

ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wallet"
  ON user_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own billing_transactions"
  ON billing_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full user_wallets"
  ON user_wallets FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full billing_transactions"
  ON billing_transactions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
