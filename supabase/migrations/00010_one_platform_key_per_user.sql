-- At most one Silk platform API key per user (provider_id IS NULL; key_type = 'platform').
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_one_platform_per_user
  ON user_api_keys (user_id)
  WHERE key_type = 'platform';
