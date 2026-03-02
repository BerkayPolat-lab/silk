-- Add ERD columns to models
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS model_url TEXT,
  ADD COLUMN IF NOT EXISTS type_of_ai TEXT,
  ADD COLUMN IF NOT EXISTS gb_size NUMERIC,
  ADD COLUMN IF NOT EXISTS parameters TEXT,
  ADD COLUMN IF NOT EXISTS layers INTEGER,
  ADD COLUMN IF NOT EXISTS format TEXT,
  ADD COLUMN IF NOT EXISTS license TEXT;


-- Benchmark: Model to benchmark vs Models benchmarked against (with metric, comparison_category, score)
CREATE TABLE model_benchmarks (
  benchmark_model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  benchmarked_against_model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  comparison_category TEXT,
  score NUMERIC,
  PRIMARY KEY (benchmark_model_id, benchmarked_against_model_id, metric),
  CHECK (benchmark_model_id != benchmarked_against_model_id)
);

-- RLS for new table
ALTER TABLE model_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read model_benchmarks" ON model_benchmarks FOR SELECT USING (true);
