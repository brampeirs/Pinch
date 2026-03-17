-- ============ HYBRID SEARCH MIGRATION ============
-- Adds tags column and updates search_recipes RPC for hybrid search

-- Add tags column to recipes
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN(tags);

-- Drop existing search_recipes function
DROP FUNCTION IF EXISTS search_recipes(vector(1536), int, float);

-- Create new search_recipes with filter parameters
CREATE OR REPLACE FUNCTION search_recipes(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.25,
  filter_category text DEFAULT NULL,
  filter_tags text[] DEFAULT NULL,
  filter_max_time int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  image_url text,
  category_name text,
  prep_time int,
  cook_time int,
  tags text[],
  similarity float
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.description,
    r.image_url,
    c.name AS category_name,
    r.prep_time,
    r.cook_time,
    r.tags,
    (re.embedding <#> query_embedding) * -1 AS similarity
  FROM recipe_embeddings re
  JOIN recipes r ON r.id = re.recipe_id
  LEFT JOIN categories c ON c.id = r.category_id
  WHERE r.is_published = true
    -- Exact category filter (case-insensitive)
    AND (filter_category IS NULL OR LOWER(c.name) = LOWER(filter_category))
    -- Tags overlap filter (recipe must have at least one of the filter tags)
    AND (filter_tags IS NULL OR r.tags && filter_tags)
    -- Max time filter (prep + cook time)
    AND (filter_max_time IS NULL OR (r.prep_time + r.cook_time) <= filter_max_time)
    -- Semantic threshold
    AND (re.embedding <#> query_embedding) * -1 > match_threshold
  ORDER BY re.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;

