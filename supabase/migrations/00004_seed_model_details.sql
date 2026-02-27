-- Add documentation URLs and output examples for model detail pages
UPDATE models SET 
  documentation_url = 'https://docs.anthropic.com/en/docs/claude',
  output_examples = '[
    {"prompt": "Write a Python function to validate email addresses", "output": "def is_valid_email(email: str) -> bool:\n    import re\n    pattern = r\"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$\"\n    return bool(re.match(pattern, email))"},
    {"prompt": "Summarize this in one sentence: [long text...]", "output": "This document discusses..."}
  ]'::jsonb
WHERE slug = 'claude-sonnet-4-5';

UPDATE models SET 
  documentation_url = 'https://ai.google.dev/gemini-api/docs',
  output_examples = '[{"prompt": "What is the capital of France?", "output": "The capital of France is Paris."}]'::jsonb
WHERE slug IN ('gemini-3-flash-preview', 'gemini-2-5-flash', 'gemini-2-5-flash-lite');

UPDATE models SET documentation_url = 'https://platform.deepseek.com/api-docs' WHERE slug = 'deepseek-v3-2';
