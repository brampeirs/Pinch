-- Enable pgvector extension
-- This must run before any migrations that use the vector type
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
