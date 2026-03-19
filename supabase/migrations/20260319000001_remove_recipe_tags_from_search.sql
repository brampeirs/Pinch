-- ============================================
-- REMOVE RECIPE TAGS COLUMN FROM SEARCH FLOW
-- ============================================
-- The recipes.tags column was removed from the schema.
-- Recreate the semantic search RPC without tags-based filtering.

DROP INDEX IF EXISTS idx_recipes_tags;

ALTER TABLE public.recipes
DROP COLUMN IF EXISTS tags;

DROP FUNCTION IF EXISTS search_recipes(extensions.vector(1536), int, float, text, text[], int);

CREATE OR REPLACE FUNCTION search_recipes(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.25,
  filter_category text DEFAULT NULL,
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
    (re.embedding <#> query_embedding) * -1 AS similarity
  FROM recipe_embeddings re
  JOIN recipes r ON r.id = re.recipe_id
  LEFT JOIN categories c ON c.id = r.category_id
  WHERE r.is_published = true
    AND (filter_category IS NULL OR LOWER(c.name) = LOWER(filter_category))
    AND (filter_max_time IS NULL OR (r.prep_time + r.cook_time) <= filter_max_time)
    AND (re.embedding <#> query_embedding) * -1 > match_threshold
  ORDER BY re.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;