-- Add model-level aggregate fields for ratings/review count
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- Helpful index for aggregate queries and review listing by model
CREATE INDEX IF NOT EXISTS reviews_model_id_idx ON reviews(model_id);

-- Recompute a single model's aggregates
CREATE OR REPLACE FUNCTION refresh_model_review_stats(p_model_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE models m
  SET
    avg_rating = COALESCE(
      (
        SELECT ROUND(AVG(r.rating)::numeric, 2)
        FROM reviews r
        WHERE r.model_id = p_model_id
      ),
      0
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews r
      WHERE r.model_id = p_model_id
    )
  WHERE m.id = p_model_id;
END;
$$;

-- Recompute a provider's aggregates from all reviews on its models
CREATE OR REPLACE FUNCTION refresh_provider_review_stats(p_provider_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE providers p
  SET
    avg_rating = COALESCE(
      (
        SELECT ROUND(AVG(r.rating)::numeric, 2)
        FROM models m
        LEFT JOIN reviews r ON r.model_id = m.id
        WHERE m.provider_id = p_provider_id
      ),
      0
    ),
    total_reviews = (
      SELECT COUNT(r.*)
      FROM models m
      LEFT JOIN reviews r ON r.model_id = m.id
      WHERE m.provider_id = p_provider_id
    )
  WHERE p.id = p_provider_id;
END;
$$;

-- Trigger function: recompute affected model/provider stats after review changes
CREATE OR REPLACE FUNCTION on_review_stats_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_provider_id UUID;
  old_provider_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_model_review_stats(NEW.model_id);
    SELECT provider_id INTO new_provider_id FROM models WHERE id = NEW.model_id;
    IF new_provider_id IS NOT NULL THEN
      PERFORM refresh_provider_review_stats(new_provider_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If model_id changed, update both old and new model/provider aggregates.
    IF NEW.model_id <> OLD.model_id THEN
      PERFORM refresh_model_review_stats(OLD.model_id);
      PERFORM refresh_model_review_stats(NEW.model_id);

      SELECT provider_id INTO old_provider_id FROM models WHERE id = OLD.model_id;
      SELECT provider_id INTO new_provider_id FROM models WHERE id = NEW.model_id;

      IF old_provider_id IS NOT NULL THEN
        PERFORM refresh_provider_review_stats(old_provider_id);
      END IF;
      IF new_provider_id IS NOT NULL AND new_provider_id <> old_provider_id THEN
        PERFORM refresh_provider_review_stats(new_provider_id);
      END IF;
    ELSE
      PERFORM refresh_model_review_stats(NEW.model_id);
      SELECT provider_id INTO new_provider_id FROM models WHERE id = NEW.model_id;
      IF new_provider_id IS NOT NULL THEN
        PERFORM refresh_provider_review_stats(new_provider_id);
      END IF;
    END IF;
    RETURN NEW;
  ELSE -- DELETE
    PERFORM refresh_model_review_stats(OLD.model_id);
    SELECT provider_id INTO old_provider_id FROM models WHERE id = OLD.model_id;
    IF old_provider_id IS NOT NULL THEN
      PERFORM refresh_provider_review_stats(old_provider_id);
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS reviews_stats_after_change ON reviews;
CREATE TRIGGER reviews_stats_after_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION on_review_stats_change();

-- Backfill all existing model/provider aggregates
UPDATE models m
SET
  avg_rating = COALESCE(agg.avg_rating, 0),
  total_reviews = COALESCE(agg.total_reviews, 0)
FROM (
  SELECT
    m2.id AS model_id,
    ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
    COUNT(r.*) AS total_reviews
  FROM models m2
  LEFT JOIN reviews r ON r.model_id = m2.id
  GROUP BY m2.id
) agg
WHERE m.id = agg.model_id;

UPDATE providers p
SET
  avg_rating = COALESCE(agg.avg_rating, 0),
  total_reviews = COALESCE(agg.total_reviews, 0)
FROM (
  SELECT
    p2.id AS provider_id,
    ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
    COUNT(r.*) AS total_reviews
  FROM providers p2
  LEFT JOIN models m ON m.provider_id = p2.id
  LEFT JOIN reviews r ON r.model_id = m.id
  GROUP BY p2.id
) agg
WHERE p.id = agg.provider_id;

