-- Add api_docs for model detail pages
UPDATE models SET api_docs = 'https://docs.anthropic.com/en/docs/claude'
WHERE slug = 'claude-sonnet-4-5';

UPDATE models SET api_docs = 'https://ai.google.dev/gemini-api/docs'
WHERE slug IN ('gemini-3-flash-preview', 'gemini-2-5-flash', 'gemini-2-5-flash-lite');

UPDATE models SET api_docs = 'https://platform.deepseek.com/api-docs'
WHERE slug = 'deepseek-v3-2';
