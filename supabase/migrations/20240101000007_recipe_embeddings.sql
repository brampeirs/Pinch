-- ============ RECIPE EMBEDDINGS (pgvector) ============
-- Stores vector embeddings for semantic recipe search
-- Note: pgvector extension should already be enabled in Supabase dashboard

-- Create the recipe_embeddings table
CREATE TABLE public.recipe_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE UNIQUE NOT NULL,
  content TEXT NOT NULL,                              -- Canonical text that was embedded
  embedding extensions.vector(1536) NOT NULL,         -- OpenAI text-embedding-3-small dimension
  model TEXT DEFAULT 'text-embedding-3-small',        -- Model version for future reference
  tokens INTEGER,                                     -- Token count (for monitoring)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast similarity search using cosine distance
-- Using ivfflat for good balance of speed and accuracy
CREATE INDEX recipe_embeddings_embedding_idx
  ON recipe_embeddings USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

-- Index for looking up by recipe_id
CREATE INDEX recipe_embeddings_recipe_id_idx ON recipe_embeddings(recipe_id);

-- RLS policies
ALTER TABLE recipe_embeddings ENABLE ROW LEVEL SECURITY;

-- Everyone can read embeddings (needed for search)
CREATE POLICY "Anyone can read recipe embeddings"
  ON recipe_embeddings FOR SELECT
  USING (true);

-- Only service role can insert/update (edge functions use service role)
CREATE POLICY "Service role can manage embeddings"
  ON recipe_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
