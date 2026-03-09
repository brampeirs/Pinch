-- ============================================
-- STORAGE BUCKET FOR RECIPE IMAGES
-- ============================================

-- Create the storage bucket for recipe images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- ============ STORAGE POLICIES ============

-- Allow anyone to view images (public bucket)
CREATE POLICY "Public read access for recipe images"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

-- Allow anyone to upload images (for development)
CREATE POLICY "Anyone can upload recipe images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recipe-images');

-- Allow anyone to update their images
CREATE POLICY "Anyone can update recipe images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'recipe-images');

-- Allow anyone to delete images
CREATE POLICY "Anyone can delete recipe images"
ON storage.objects FOR DELETE
USING (bucket_id = 'recipe-images');

