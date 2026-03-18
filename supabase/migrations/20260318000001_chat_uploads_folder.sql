-- Document chat-uploads folder structure for recipe-images bucket
-- 
-- Storage structure:
--   recipe-images/
--   ├── recipes/          ← permanent cover photos (created by uploadImage tool)
--   └── chat-uploads/     ← temporary uploads (created by client before sending)
--
-- Note: Supabase Storage doesn't require explicit folder creation.
-- Folders are created automatically on first upload.
-- The existing policies in 20240101000006_recipe_images_storage.sql already allow
-- uploads to any path in the recipe-images bucket (no path restriction).
--
-- This migration documents the intended structure for clarity.

COMMENT ON EXTENSION pg_stat_statements IS 
  'Storage bucket recipe-images uses: recipes/ for permanent images, chat-uploads/ for temporary chat images';

