-- Companies: owner companies (Anthropic, Google, etc.)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Providers: API providers with ratings
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Models: LLM models (10 from image)
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  highlights JSONB DEFAULT '[]',
  api_docs TEXT,
  litellm_model_id TEXT,
  embedding vector(1536),
  rank_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS models_embedding_idx ON models 
USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Reviews: developer/business reviews (PK: model_id, comment_id)
CREATE TABLE IF NOT EXISTS reviews (
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (model_id, comment_id)
);

-- User API keys: platform API keys for users
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API usage: track which APIs users tried
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES user_api_keys(id) ON DELETE SET NULL,
  first_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, model_id, api_key_id)
);

-- RLS policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Public read for companies, providers, models, products, reviews
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Public read providers" ON providers FOR SELECT USING (true);
CREATE POLICY "Public read models" ON models FOR SELECT USING (true);
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);

-- Authenticated users can insert reviews
CREATE POLICY "Authenticated insert reviews" ON reviews FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE 
  USING (auth.uid() = user_id);

-- User API keys: users can only access their own
CREATE POLICY "Users read own api_keys" ON user_api_keys FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own api_keys" ON user_api_keys FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own api_keys" ON user_api_keys FOR DELETE 
  USING (auth.uid() = user_id);

-- API usage: users can only access their own
CREATE POLICY "Users read own api_usage" ON api_usage FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "Service role full api_usage" ON api_usage FOR ALL 
  USING (auth.jwt()->>'role' = 'service_role');
