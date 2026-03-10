-- ============================================
-- RESET DATABASE AND RE-SEED (ENGLISH VERSION)
-- Run this in the Supabase SQL Editor
-- ============================================

-- Step 1: Clear all data (in correct order to respect foreign keys)
TRUNCATE TABLE recipe_embeddings CASCADE;
TRUNCATE TABLE recipe_steps CASCADE;
TRUNCATE TABLE ingredients CASCADE;
TRUNCATE TABLE recipes CASCADE;
TRUNCATE TABLE categories CASCADE;

-- Step 2: Insert categories (English)
INSERT INTO public.categories (name, slug, emoji, description) VALUES
  ('Pasta', 'pasta', '🍝', 'Italian pasta dishes'),
  ('Soups', 'soups', '🍲', 'Hot and cold soups'),
  ('Salads', 'salads', '🥗', 'Fresh salads'),
  ('Bowls', 'bowls', '🍜', 'Healthy bowls'),
  ('Desserts', 'desserts', '🍰', 'Sweet desserts'),
  ('Breakfast', 'breakfast', '🍳', 'Breakfast recipes'),
  ('Mains', 'mains', '🍖', 'Main courses'),
  ('Appetizers', 'appetizers', '🥟', 'Starters and appetizers');

-- Step 3: Insert recipes
-- Pasta Carbonara
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid, id, 'Pasta Carbonara',
  'Creamy Italian pasta with bacon, egg, and Parmesan cheese',
  'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800', 10, 20, 2, true
FROM public.categories WHERE slug = 'pasta';

-- Chicken Teriyaki Bowl
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '22222222-2222-2222-2222-222222222222'::uuid, id, 'Chicken Teriyaki Bowl',
  'Tender chicken in sweet teriyaki sauce with rice and vegetables',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800', 15, 25, 2, true
FROM public.categories WHERE slug = 'bowls';

-- Avocado Toast
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '33333333-3333-3333-3333-333333333333'::uuid, id, 'Avocado Toast',
  'Crispy toast with creamy avocado and a poached egg',
  'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800', 5, 10, 1, true
FROM public.categories WHERE slug = 'breakfast';

-- Tom Kha Gai
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '44444444-4444-4444-4444-444444444444'::uuid, id, 'Tom Kha Gai',
  'Thai coconut soup with chicken, galangal, and lemongrass',
  'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=800', 15, 30, 4, true
FROM public.categories WHERE slug = 'soups';

-- Caesar Salad
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '55555555-5555-5555-5555-555555555555'::uuid, id, 'Classic Caesar Salad',
  'Crisp romaine lettuce with creamy Caesar dressing, croutons, and Parmesan',
  'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800', 15, 0, 2, true
FROM public.categories WHERE slug = 'salads';

-- Grilled Salmon
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '66666666-6666-6666-6666-666666666666'::uuid, id, 'Grilled Salmon with Lemon Herb',
  'Perfectly grilled salmon fillet with fresh herbs and lemon butter sauce',
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800', 10, 15, 2, true
FROM public.categories WHERE slug = 'mains';

-- Chocolate Lava Cake
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '77777777-7777-7777-7777-777777777777'::uuid, id, 'Chocolate Lava Cake',
  'Decadent chocolate cake with a molten center, served warm',
  'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800', 15, 12, 2, true
FROM public.categories WHERE slug = 'desserts';

-- Bruschetta
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '88888888-8888-8888-8888-888888888888'::uuid, id, 'Classic Bruschetta',
  'Toasted bread topped with fresh tomatoes, basil, and garlic',
  'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800', 15, 5, 4, true
FROM public.categories WHERE slug = 'appetizers';

-- Step 4: Insert ingredients
-- Pasta Carbonara
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 200, 'g', 'Spaghetti', 1),
  ('11111111-1111-1111-1111-111111111111', 100, 'g', 'Pancetta or bacon', 2),
  ('11111111-1111-1111-1111-111111111111', 2, 'pcs', 'Egg yolks', 3),
  ('11111111-1111-1111-1111-111111111111', 50, 'g', 'Parmesan cheese', 4),
  ('11111111-1111-1111-1111-111111111111', 1, 'clove', 'Garlic', 5),
  ('11111111-1111-1111-1111-111111111111', 1, 'tbsp', 'Olive oil', 6);

-- Chicken Teriyaki Bowl
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222222', 300, 'g', 'Chicken breast', 1),
  ('22222222-2222-2222-2222-222222222222', 150, 'g', 'Rice', 2),
  ('22222222-2222-2222-2222-222222222222', 3, 'tbsp', 'Teriyaki sauce', 3),
  ('22222222-2222-2222-2222-222222222222', 1, 'pc', 'Cucumber', 4),
  ('22222222-2222-2222-2222-222222222222', 1, 'pc', 'Carrot', 5);

-- Avocado Toast
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('33333333-3333-3333-3333-333333333333', 2, 'slices', 'Sourdough bread', 1),
  ('33333333-3333-3333-3333-333333333333', 1, 'pc', 'Ripe avocado', 2),
  ('33333333-3333-3333-3333-333333333333', 2, 'pcs', 'Eggs', 3),
  ('33333333-3333-3333-3333-333333333333', 1, 'pinch', 'Red pepper flakes', 4),
  ('33333333-3333-3333-3333-333333333333', 1, 'tbsp', 'Olive oil', 5);

-- Tom Kha Gai
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('44444444-4444-4444-4444-444444444444', 400, 'ml', 'Coconut milk', 1),
  ('44444444-4444-4444-4444-444444444444', 300, 'g', 'Chicken thigh', 2),
  ('44444444-4444-4444-4444-444444444444', 2, 'stalks', 'Lemongrass', 3),
  ('44444444-4444-4444-4444-444444444444', 3, 'slices', 'Galangal', 4),
  ('44444444-4444-4444-4444-444444444444', 2, 'tbsp', 'Fish sauce', 5),
  ('44444444-4444-4444-4444-444444444444', 1, 'tbsp', 'Lime juice', 6);

-- Caesar Salad
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('55555555-5555-5555-5555-555555555555', 1, 'head', 'Romaine lettuce', 1),
  ('55555555-5555-5555-5555-555555555555', 50, 'g', 'Parmesan cheese', 2),
  ('55555555-5555-5555-5555-555555555555', 100, 'g', 'Croutons', 3),
  ('55555555-5555-5555-5555-555555555555', 4, 'tbsp', 'Caesar dressing', 4),
  ('55555555-5555-5555-5555-555555555555', 2, 'fillets', 'Anchovies', 5);

-- Grilled Salmon
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('66666666-6666-6666-6666-666666666666', 2, 'fillets', 'Salmon', 1),
  ('66666666-6666-6666-6666-666666666666', 1, 'pc', 'Lemon', 2),
  ('66666666-6666-6666-6666-666666666666', 2, 'tbsp', 'Butter', 3),
  ('66666666-6666-6666-6666-666666666666', 2, 'sprigs', 'Fresh dill', 4),
  ('66666666-6666-6666-6666-666666666666', 2, 'cloves', 'Garlic', 5);

-- Chocolate Lava Cake
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('77777777-7777-7777-7777-777777777777', 100, 'g', 'Dark chocolate', 1),
  ('77777777-7777-7777-7777-777777777777', 100, 'g', 'Butter', 2),
  ('77777777-7777-7777-7777-777777777777', 2, 'pcs', 'Eggs', 3),
  ('77777777-7777-7777-7777-777777777777', 50, 'g', 'Sugar', 4),
  ('77777777-7777-7777-7777-777777777777', 30, 'g', 'Flour', 5);

-- Bruschetta
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('88888888-8888-8888-8888-888888888888', 4, 'slices', 'Ciabatta bread', 1),
  ('88888888-8888-8888-8888-888888888888', 4, 'pcs', 'Roma tomatoes', 2),
  ('88888888-8888-8888-8888-888888888888', 1, 'bunch', 'Fresh basil', 3),
  ('88888888-8888-8888-8888-888888888888', 2, 'cloves', 'Garlic', 4),
  ('88888888-8888-8888-8888-888888888888', 3, 'tbsp', 'Extra virgin olive oil', 5),
  ('88888888-8888-8888-8888-888888888888', 1, 'tbsp', 'Balsamic vinegar', 6);

-- Step 5: Insert recipe steps
-- Pasta Carbonara
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 1, 'Cook the spaghetti in salted water according to package instructions.'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Fry the pancetta in a pan with olive oil until crispy.'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Whisk the egg yolks with Parmesan cheese and pepper.'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Drain the pasta, reserving a cup of pasta water.'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Remove the pan from heat and stir in the egg-cheese mixture.');

-- Chicken Teriyaki Bowl
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('22222222-2222-2222-2222-222222222222', 1, 'Cook the rice according to package instructions.'),
  ('22222222-2222-2222-2222-222222222222', 2, 'Cut the chicken into cubes and cook until golden brown.'),
  ('22222222-2222-2222-2222-222222222222', 3, 'Add the teriyaki sauce and let it reduce for 2 minutes.'),
  ('22222222-2222-2222-2222-222222222222', 4, 'Serve the chicken over rice with fresh vegetables.');

-- Avocado Toast
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('33333333-3333-3333-3333-333333333333', 1, 'Toast the bread until golden and crispy.'),
  ('33333333-3333-3333-3333-333333333333', 2, 'Mash the avocado and season with salt and pepper.'),
  ('33333333-3333-3333-3333-333333333333', 3, 'Poach the eggs in simmering water for 3 minutes.'),
  ('33333333-3333-3333-3333-333333333333', 4, 'Spread avocado on toast and top with poached eggs.');

-- Tom Kha Gai
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('44444444-4444-4444-4444-444444444444', 1, 'Bring coconut milk to a simmer with lemongrass and galangal.'),
  ('44444444-4444-4444-4444-444444444444', 2, 'Add sliced chicken and cook until done.'),
  ('44444444-4444-4444-4444-444444444444', 3, 'Season with fish sauce and lime juice.'),
  ('44444444-4444-4444-4444-444444444444', 4, 'Garnish with fresh cilantro and serve hot.');

-- Caesar Salad
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('55555555-5555-5555-5555-555555555555', 1, 'Wash and chop the romaine lettuce into bite-sized pieces.'),
  ('55555555-5555-5555-5555-555555555555', 2, 'Toss lettuce with Caesar dressing.'),
  ('55555555-5555-5555-5555-555555555555', 3, 'Top with croutons, shaved Parmesan, and anchovies.');

-- Grilled Salmon
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('66666666-6666-6666-6666-666666666666', 1, 'Season salmon fillets with salt, pepper, and lemon zest.'),
  ('66666666-6666-6666-6666-666666666666', 2, 'Grill on medium-high heat for 4-5 minutes per side.'),
  ('66666666-6666-6666-6666-666666666666', 3, 'Prepare lemon butter sauce by melting butter with garlic and lemon juice.'),
  ('66666666-6666-6666-6666-666666666666', 4, 'Drizzle sauce over salmon and garnish with fresh dill.');

-- Chocolate Lava Cake
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('77777777-7777-7777-7777-777777777777', 1, 'Melt chocolate and butter together over a double boiler.'),
  ('77777777-7777-7777-7777-777777777777', 2, 'Whisk eggs with sugar until light and fluffy.'),
  ('77777777-7777-7777-7777-777777777777', 3, 'Fold in the chocolate mixture and flour.'),
  ('77777777-7777-7777-7777-777777777777', 4, 'Pour into greased ramekins and bake at 200°C for 12 minutes.'),
  ('77777777-7777-7777-7777-777777777777', 5, 'Let cool for 1 minute, then invert onto a plate and serve immediately.');

-- Bruschetta
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('88888888-8888-8888-8888-888888888888', 1, 'Dice tomatoes and mix with chopped basil, minced garlic, and olive oil.'),
  ('88888888-8888-8888-8888-888888888888', 2, 'Season with salt, pepper, and balsamic vinegar. Let marinate for 10 minutes.'),
  ('88888888-8888-8888-8888-888888888888', 3, 'Toast the bread slices until golden.'),
  ('88888888-8888-8888-8888-888888888888', 4, 'Rub toast with garlic and top with tomato mixture. Serve immediately.');

-- Show result
SELECT 'Data reset complete!' as status, COUNT(*) as recipe_count FROM recipes;

