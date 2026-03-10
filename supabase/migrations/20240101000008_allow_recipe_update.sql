-- ============================================
-- ALLOW ANONYMOUS RECIPE UPDATES AND DELETES (FOR DEVELOPMENT)
-- ============================================
-- This migration adds policies that allow unauthenticated users to update/delete recipes.
-- Remove or modify these policies when you implement authentication.

-- Drop and recreate to ensure idempotency
DROP POLICY IF EXISTS "Anyone can update recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can delete recipes" ON public.recipes;

-- Create policy that allows anyone to update recipes
CREATE POLICY "Anyone can update recipes" ON public.recipes
  FOR UPDATE USING (true) WITH CHECK (true);

-- Create policy that allows anyone to delete recipes
CREATE POLICY "Anyone can delete recipes" ON public.recipes
  FOR DELETE USING (true);
