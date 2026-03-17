-- ============================================
-- ADD SECTION SUPPORT FOR INGREDIENTS AND STEPS
-- ============================================
-- Allows grouping ingredients and steps into named sections
-- e.g., "De Saus", "De Pasta", "De Afwerking"

-- Add section_name to ingredients
ALTER TABLE public.ingredients
ADD COLUMN section_name TEXT;

-- Add section_name to recipe_steps  
ALTER TABLE public.recipe_steps
ADD COLUMN section_name TEXT;

-- Create indexes for efficient grouping
CREATE INDEX idx_ingredients_section ON public.ingredients(recipe_id, section_name);
CREATE INDEX idx_recipe_steps_section ON public.recipe_steps(recipe_id, section_name);

-- Add a comment explaining the usage
COMMENT ON COLUMN public.ingredients.section_name IS 
  'Optional section name for grouping ingredients (e.g., "De Saus", "Het Deeg"). NULL means no section.';

COMMENT ON COLUMN public.recipe_steps.section_name IS 
  'Optional section name for grouping steps (e.g., "Voorbereiding", "De Saus"). NULL means no section.';

