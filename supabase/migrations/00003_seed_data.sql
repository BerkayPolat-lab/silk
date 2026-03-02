-- Seed companies (ids generated via gen_random_uuid() / DEFAULT)
WITH inserted_companies AS (
  INSERT INTO companies (name, logo_url, website)
  VALUES
    ('MiniMax', null, 'https://minimax.chat'),
    ('Moonshot AI', null, 'https://moonshot.cn'),
    ('Google', null, 'https://ai.google.dev'),
    ('DeepSeek', null, 'https://deepseek.com'),
    ('Anthropic', null, 'https://anthropic.com'),
    ('xAI', null, 'https://x.ai'),
    ('Zhipu AI', null, 'https://open.bigmodel.cn')
  RETURNING id, name
),
-- Seed providers
inserted_providers AS (
  INSERT INTO providers (company_id, name, slug, avg_rating)
  SELECT c.id, p.name, p.slug, p.avg_rating
  FROM (VALUES
    ('MiniMax', 'minimax', 'minimax', 4.2),
    ('Moonshot AI', 'moonshotai', 'moonshotai', 4.3),
    ('Google', 'google', 'google', 4.5),
    ('DeepSeek', 'deepseek', 'deepseek', 4.6),
    ('Anthropic', 'anthropic', 'anthropic', 4.7),
    ('xAI', 'x-ai', 'x-ai', 4.1),
    ('Zhipu AI', 'z-ai', 'z-ai', 4.0)
  ) AS p(company_name, name, slug, avg_rating)
  JOIN inserted_companies c ON c.name = p.company_name
  RETURNING id, slug
),
-- Seed models (10 from image)
inserted_models AS (
  INSERT INTO models (provider_id, name, slug, description, highlights, rank_order, litellm_model_id)
  SELECT pr.id, m.name, m.slug, m.description, m.highlights::jsonb, m.rank_order, m.litellm_model_id
  FROM (VALUES
    ('minimax', 'MiniMax M2.5', 'minimax-m2-5', 'MiniMax M2.5 is a high-performance multimodal language model from MiniMax, excelling in Chinese and English tasks.', '["High token throughput", "Strong multilingual support", "Fast inference"]', 1, 'minimax/M2.5'),
    ('moonshotai', 'Kimi K2.5', 'kimi-k2-5', 'Kimi K2.5 by Moonshot AI offers long-context understanding and strong reasoning capabilities.', '["Long context window", "Strong reasoning", "Code generation"]', 2, 'moonshot/Kimi-k2.5'),
    ('google', 'Gemini 3 Flash Preview', 'gemini-3-flash-preview', 'Google Gemini 3 Flash is a fast, efficient model optimized for high-throughput applications.', '["Ultra-fast inference", "Cost-effective", "Google infrastructure"]', 3, 'gemini/gemini-3-flash-preview'),
    ('deepseek', 'DeepSeek V3.2', 'deepseek-v3-2', 'DeepSeek V3.2 delivers strong performance at competitive pricing for developers and enterprises.', '["Excellent value", "Strong coding", "Wide adoption"]', 4, 'deepseek/deepseek-chat-v3-2'),
    ('anthropic', 'Claude Sonnet 4.5', 'claude-sonnet-4-5', 'Claude Sonnet 4.5 from Anthropic balances speed, intelligence, and cost for production workloads.', '["Balanced performance", "Strong safety", "Enterprise-ready"]', 5, 'anthropic/claude-sonnet-4-20250514'),
    ('x-ai', 'Grok 4.1 Fast', 'grok-4-1-fast', 'Grok 4.1 Fast from xAI offers rapid responses for real-time applications.', '["Real-time inference", "Growing ecosystem", "xAI infrastructure"]', 6, 'x-ai/grok-4-1-fast'),
    ('google', 'Gemini 2.5 Flash', 'gemini-2-5-flash', 'Gemini 2.5 Flash provides fast, efficient inference for high-volume use cases.', '["Fast and efficient", "Scalable", "Multimodal"]', 7, 'gemini/gemini-2.5-flash'),
    ('z-ai', 'GLM 5', 'glm-5', 'GLM 5 from Zhipu AI is a versatile model for Chinese and global applications.', '["Multilingual", "Versatile", "Cost-effective"]', 8, 'zhipu/glm-5'),
    ('anthropic', 'Claude Opus 4.6', 'claude-opus-4-6', 'Claude Opus 4.6 is Anthropic''s most capable model for complex reasoning and analysis.', '["Top-tier reasoning", "Complex tasks", "High accuracy"]', 9, 'anthropic/claude-opus-4-20250514'),
    ('google', 'Gemini 2.5 Flash Lite', 'gemini-2-5-flash-lite', 'Gemini 2.5 Flash Lite is the most cost-effective option for simple, high-volume tasks.', '["Budget-friendly", "High throughput", "Simple tasks"]', 10, 'gemini/gemini-2.5-flash-lite')
  ) AS m(provider_slug, name, slug, description, highlights, rank_order, litellm_model_id)
  JOIN inserted_providers pr ON pr.slug = m.provider_slug
  RETURNING id, slug
)
-- Seed sample reviews
INSERT INTO reviews (model_id, author_name, rating, content)
SELECT mod.id, r.author_name, r.rating, r.content
FROM (VALUES
  ('claude-sonnet-4-5', 'Sarah K.', 5, 'Claude Sonnet 4.5 has been excellent for our code review pipeline. Fast and reliable.'),
  ('claude-sonnet-4-5', 'Dev Team Lead', 4, 'Solid choice for production. Great balance of cost and capability.'),
  ('deepseek-v3-2', 'Alex M.', 5, 'DeepSeek V3.2 is unbeatable for the price. Great for prototyping.'),
  ('gemini-3-flash-preview', 'Product Manager', 4, 'Gemini 3 Flash is incredibly fast. Perfect for high-volume summarization.')
) AS r(model_slug, author_name, rating, content)
JOIN inserted_models mod ON mod.slug = r.model_slug;
