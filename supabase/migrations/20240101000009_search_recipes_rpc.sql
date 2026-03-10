-- ============ SEMANTIC SEARCH RPC ============
-- RPC function for semantic recipe search using pgvector

-- Drop all existing versions
DROP FUNCTION IF EXISTS search_recipes(extensions.vector, int);
DROP FUNCTION IF EXISTS search_recipes(extensions.vector(1536), int);
DROP FUNCTION IF EXISTS search_recipes(vector, int);
DROP FUNCTION IF EXISTS search_recipes(vector(1536), int);
DROP FUNCTION IF EXISTS search_recipes(text, int);
DROP FUNCTION IF EXISTS search_recipes(vector(1536), int, float);

-- Accept vector directly with similarity threshold
CREATE OR REPLACE FUNCTION search_recipes(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  image_url text,
  category_name text,
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
    (re.embedding <#> query_embedding) * -1 AS similarity
  FROM recipe_embeddings re
  JOIN recipes r ON r.id = re.recipe_id
  LEFT JOIN categories c ON c.id = r.category_id
  WHERE r.is_published = true
    AND (re.embedding <#> query_embedding) * -1 > match_threshold
  ORDER BY re.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;

