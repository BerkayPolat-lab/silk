-- Add model performance metadata fields used by compare/search UI.
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS context_length_tokens BIGINT,
  ADD COLUMN IF NOT EXISTS latency_ttft_ms INTEGER,
  ADD COLUMN IF NOT EXISTS throughput_tokens_per_sec NUMERIC,
  ADD COLUMN IF NOT EXISTS perf_source TEXT,
  ADD COLUMN IF NOT EXISTS perf_updated_at TIMESTAMPTZ;

-- Lightweight safety checks for numeric fields.
ALTER TABLE public.models
  DROP CONSTRAINT IF EXISTS models_context_length_tokens_nonnegative,
  DROP CONSTRAINT IF EXISTS models_latency_ttft_ms_nonnegative,
  DROP CONSTRAINT IF EXISTS models_throughput_tokens_per_sec_nonnegative;

ALTER TABLE public.models
  ADD CONSTRAINT models_context_length_tokens_nonnegative
    CHECK (context_length_tokens IS NULL OR context_length_tokens >= 0),
  ADD CONSTRAINT models_latency_ttft_ms_nonnegative
    CHECK (latency_ttft_ms IS NULL OR latency_ttft_ms >= 0),
  ADD CONSTRAINT models_throughput_tokens_per_sec_nonnegative
    CHECK (throughput_tokens_per_sec IS NULL OR throughput_tokens_per_sec >= 0);
