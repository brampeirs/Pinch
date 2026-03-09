-- ============================================
-- ALLOW ANONYMOUS RECIPE CREATION (FOR DEVELOPMENT)
-- ============================================
-- This migration adds policies that allow unauthenticated users to create recipes.
-- Remove or modify these policies when you implement authentication.

-- Drop existing restrictive INSERT policy for recipes
DROP POLICY IF EXISTS "Users can create recipes" ON public.recipes;

-- Create new policy that allows anyone to insert recipes
CREATE POLICY "Anyone can create recipes" ON public.recipes
  FOR INSERT WITH CHECK (true);

-- Drop existing policy for ingredients and create a more permissive one
DROP POLICY IF EXISTS "Users can manage ingredients of own recipes" ON public.ingredients;

CREATE POLICY "Anyone can insert ingredients" ON public.ingredients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = ingredients.recipe_id
    )
  );

CREATE POLICY "Anyone can update ingredients" ON public.ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = ingredients.recipe_id
    )
  );

CREATE POLICY "Anyone can delete ingredients" ON public.ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = ingredients.recipe_id
    )
  );

-- Drop existing policy for recipe_steps and create a more permissive one
DROP POLICY IF EXISTS "Users can manage steps of own recipes" ON public.recipe_steps;

CREATE POLICY "Anyone can insert recipe steps" ON public.recipe_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = recipe_steps.recipe_id
    )
  );

CREATE POLICY "Anyone can update recipe steps" ON public.recipe_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = recipe_steps.recipe_id
    )
  );

CREATE POLICY "Anyone can delete recipe steps" ON public.recipe_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = recipe_steps.recipe_id
    )
  );

