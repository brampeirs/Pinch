-- ============================================
-- SEED DATA
-- ============================================

-- Insert categories
INSERT INTO public.categories (name, slug, emoji, description) VALUES
  ('Pasta', 'pasta', '🍝', 'Italian pasta dishes'),
  ('Soups', 'soups', '🍲', 'Warm and cold soups'),
  ('Salads', 'salads', '🥗', 'Fresh salads'),
  ('Main Dishes', 'main-dishes', '🍖', 'Hearty main courses'),
  ('Desserts', 'desserts', '🍰', 'Sweet desserts'),
  ('Breakfast', 'breakfast', '🍳', 'Breakfast recipes');

-- ============================================
-- RECIPE 1: Pasta Carbonara
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid,
  id,
  'Pasta Carbonara',
  'Creamy Italian pasta with crispy pancetta, egg yolks, and Parmesan cheese',
  'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  10, 20, 4, true
FROM public.categories WHERE slug = 'pasta';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 400, 'g', 'spaghetti', 1),
  ('11111111-1111-1111-1111-111111111111', 200, 'g', 'pancetta or bacon', 2),
  ('11111111-1111-1111-1111-111111111111', 4, '', 'egg yolks', 3),
  ('11111111-1111-1111-1111-111111111111', 100, 'g', 'Parmesan cheese', 4),
  ('11111111-1111-1111-1111-111111111111', 2, 'cloves', 'garlic', 5),
  ('11111111-1111-1111-1111-111111111111', 2, 'tbsp', 'olive oil', 6),
  ('11111111-1111-1111-1111-111111111111', 1, 'tsp', 'black pepper', 7);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 1, 'Bring a large pot of salted water to boil and cook spaghetti according to package instructions.'),
  ('11111111-1111-1111-1111-111111111111', 2, 'While pasta cooks, cut pancetta into small cubes and fry in olive oil until crispy.'),
  ('11111111-1111-1111-1111-111111111111', 3, 'In a bowl, whisk together egg yolks, grated Parmesan, and black pepper.'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Reserve 1 cup of pasta water, then drain the spaghetti.'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Remove pan from heat, add pasta to pancetta, then quickly stir in egg mixture. Add pasta water as needed for a creamy sauce.');

-- ============================================
-- RECIPE 2: Chicken Teriyaki
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '22222222-2222-2222-2222-222222222222'::uuid,
  id,
  'Chicken Teriyaki',
  'Tender chicken glazed in sweet and savory teriyaki sauce served with steamed rice',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  15, 25, 4, true
FROM public.categories WHERE slug = 'main-dishes';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222222', 600, 'g', 'chicken thighs', 1),
  ('22222222-2222-2222-2222-222222222222', 300, 'g', 'jasmine rice', 2),
  ('22222222-2222-2222-2222-222222222222', 4, 'tbsp', 'soy sauce', 3),
  ('22222222-2222-2222-2222-222222222222', 3, 'tbsp', 'mirin', 4),
  ('22222222-2222-2222-2222-222222222222', 2, 'tbsp', 'honey', 5),
  ('22222222-2222-2222-2222-222222222222', 1, 'tbsp', 'sesame oil', 6),
  ('22222222-2222-2222-2222-222222222222', 2, '', 'green onions', 7),
  ('22222222-2222-2222-2222-222222222222', 1, 'tbsp', 'sesame seeds', 8);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('22222222-2222-2222-2222-222222222222', 1, 'Cook rice according to package instructions.'),
  ('22222222-2222-2222-2222-222222222222', 2, 'Mix soy sauce, mirin, and honey to make teriyaki sauce.'),
  ('22222222-2222-2222-2222-222222222222', 3, 'Cut chicken into bite-sized pieces and season with salt.'),
  ('22222222-2222-2222-2222-222222222222', 4, 'Heat sesame oil in a pan and cook chicken until golden brown, about 6-8 minutes.'),
  ('22222222-2222-2222-2222-222222222222', 5, 'Pour teriyaki sauce over chicken and simmer until sauce thickens and coats the chicken.'),
  ('22222222-2222-2222-2222-222222222222', 6, 'Serve over rice, garnished with sliced green onions and sesame seeds.');

-- ============================================
-- RECIPE 3: Classic Tomato Soup
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '33333333-3333-3333-3333-333333333333'::uuid,
  id,
  'Classic Tomato Soup',
  'Velvety smooth tomato soup with fresh basil, perfect with a grilled cheese sandwich',
  'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
  10, 30, 4, true
FROM public.categories WHERE slug = 'soups';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('33333333-3333-3333-3333-333333333333', 800, 'g', 'canned whole tomatoes', 1),
  ('33333333-3333-3333-3333-333333333333', 1, '', 'onion', 2),
  ('33333333-3333-3333-3333-333333333333', 3, 'cloves', 'garlic', 3),
  ('33333333-3333-3333-3333-333333333333', 500, 'ml', 'vegetable broth', 4),
  ('33333333-3333-3333-3333-333333333333', 100, 'ml', 'heavy cream', 5),
  ('33333333-3333-3333-3333-333333333333', 2, 'tbsp', 'olive oil', 6),
  ('33333333-3333-3333-3333-333333333333', 1, 'handful', 'fresh basil', 7),
  ('33333333-3333-3333-3333-333333333333', 1, 'tsp', 'sugar', 8);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('33333333-3333-3333-3333-333333333333', 1, 'Dice the onion and mince the garlic.'),
  ('33333333-3333-3333-3333-333333333333', 2, 'Heat olive oil in a large pot and sauté onion until soft, about 5 minutes.'),
  ('33333333-3333-3333-3333-333333333333', 3, 'Add garlic and cook for another minute until fragrant.'),
  ('33333333-3333-3333-3333-333333333333', 4, 'Add tomatoes, broth, and sugar. Simmer for 20 minutes.'),
  ('33333333-3333-3333-3333-333333333333', 5, 'Blend soup until smooth using an immersion blender.'),
  ('33333333-3333-3333-3333-333333333333', 6, 'Stir in cream and fresh basil. Season with salt and pepper to taste.');

-- ============================================
-- RECIPE 4: Thai Coconut Soup (Tom Kha Gai)
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '44444444-4444-4444-4444-444444444444'::uuid,
  id,
  'Thai Coconut Soup',
  'Aromatic Thai soup with coconut milk, chicken, mushrooms, and fragrant lemongrass',
  'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=800',
  15, 25, 4, true
FROM public.categories WHERE slug = 'soups';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('44444444-4444-4444-4444-444444444444', 400, 'ml', 'coconut milk', 1),
  ('44444444-4444-4444-4444-444444444444', 300, 'g', 'chicken breast', 2),
  ('44444444-4444-4444-4444-444444444444', 200, 'g', 'mushrooms', 3),
  ('44444444-4444-4444-4444-444444444444', 2, 'stalks', 'lemongrass', 4),
  ('44444444-4444-4444-4444-444444444444', 3, 'slices', 'galangal or ginger', 5),
  ('44444444-4444-4444-4444-444444444444', 4, '', 'kaffir lime leaves', 6),
  ('44444444-4444-4444-4444-444444444444', 2, 'tbsp', 'fish sauce', 7),
  ('44444444-4444-4444-4444-444444444444', 1, 'tbsp', 'lime juice', 8),
  ('44444444-4444-4444-4444-444444444444', 2, '', 'Thai chilies', 9),
  ('44444444-4444-4444-4444-444444444444', 1, 'handful', 'cilantro', 10);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('44444444-4444-4444-4444-444444444444', 1, 'Slice chicken into thin strips. Slice mushrooms and bruise lemongrass stalks.'),
  ('44444444-4444-4444-4444-444444444444', 2, 'In a pot, bring coconut milk with lemongrass, galangal, and lime leaves to a simmer.'),
  ('44444444-4444-4444-4444-444444444444', 3, 'Add chicken and cook for 5-7 minutes until cooked through.'),
  ('44444444-4444-4444-4444-444444444444', 4, 'Add mushrooms and cook for another 3 minutes.'),
  ('44444444-4444-4444-4444-444444444444', 5, 'Season with fish sauce, lime juice, and sliced Thai chilies.'),
  ('44444444-4444-4444-4444-444444444444', 6, 'Serve hot, garnished with fresh cilantro.');

-- ============================================
-- RECIPE 5: Beef Stroganoff
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '55555555-5555-5555-5555-555555555555'::uuid,
  id,
  'Beef Stroganoff',
  'Tender beef strips in a rich and creamy mushroom sauce served over egg noodles',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  15, 30, 4, true
FROM public.categories WHERE slug = 'main-dishes';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('55555555-5555-5555-5555-555555555555', 500, 'g', 'beef sirloin', 1),
  ('55555555-5555-5555-5555-555555555555', 300, 'g', 'egg noodles', 2),
  ('55555555-5555-5555-5555-555555555555', 250, 'g', 'cremini mushrooms', 3),
  ('55555555-5555-5555-5555-555555555555', 1, '', 'onion', 4),
  ('55555555-5555-5555-5555-555555555555', 200, 'ml', 'sour cream', 5),
  ('55555555-5555-5555-5555-555555555555', 200, 'ml', 'beef broth', 6),
  ('55555555-5555-5555-5555-555555555555', 2, 'tbsp', 'butter', 7),
  ('55555555-5555-5555-5555-555555555555', 1, 'tbsp', 'flour', 8),
  ('55555555-5555-5555-5555-555555555555', 2, 'tbsp', 'Worcestershire sauce', 9);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('55555555-5555-5555-5555-555555555555', 1, 'Slice beef into thin strips. Slice mushrooms and dice onion.'),
  ('55555555-5555-5555-5555-555555555555', 2, 'Cook egg noodles according to package instructions.'),
  ('55555555-5555-5555-5555-555555555555', 3, 'In a large skillet, sear beef strips in butter over high heat. Remove and set aside.'),
  ('55555555-5555-5555-5555-555555555555', 4, 'Sauté onion and mushrooms in the same pan until golden.'),
  ('55555555-5555-5555-5555-555555555555', 5, 'Sprinkle flour over mushrooms, stir, then add beef broth and Worcestershire sauce.'),
  ('55555555-5555-5555-5555-555555555555', 6, 'Return beef to pan, reduce heat, and stir in sour cream. Heat through without boiling.'),
  ('55555555-5555-5555-5555-555555555555', 7, 'Serve stroganoff over egg noodles.');

-- ============================================
-- RECIPE 6: French Onion Soup
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '66666666-6666-6666-6666-666666666666'::uuid,
  id,
  'French Onion Soup',
  'Rich caramelized onion soup topped with crusty bread and melted Gruyère cheese',
  'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800',
  20, 60, 4, true
FROM public.categories WHERE slug = 'soups';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('66666666-6666-6666-6666-666666666666', 1, 'kg', 'yellow onions', 1),
  ('66666666-6666-6666-6666-666666666666', 4, 'tbsp', 'butter', 2),
  ('66666666-6666-6666-6666-666666666666', 1, 'liter', 'beef broth', 3),
  ('66666666-6666-6666-6666-666666666666', 200, 'ml', 'dry white wine', 4),
  ('66666666-6666-6666-6666-666666666666', 4, 'slices', 'baguette', 5),
  ('66666666-6666-6666-6666-666666666666', 200, 'g', 'Gruyère cheese', 6),
  ('66666666-6666-6666-6666-666666666666', 2, 'sprigs', 'fresh thyme', 7),
  ('66666666-6666-6666-6666-666666666666', 1, '', 'bay leaf', 8);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('66666666-6666-6666-6666-666666666666', 1, 'Slice onions thinly. Melt butter in a large pot over medium heat.'),
  ('66666666-6666-6666-6666-666666666666', 2, 'Add onions, reduce heat to low, and cook for 45 minutes until deeply caramelized, stirring occasionally.'),
  ('66666666-6666-6666-6666-666666666666', 3, 'Add wine and scrape up any browned bits from the bottom.'),
  ('66666666-6666-6666-6666-666666666666', 4, 'Add beef broth, thyme, and bay leaf. Simmer for 15 minutes.'),
  ('66666666-6666-6666-6666-666666666666', 5, 'Ladle soup into oven-safe bowls. Top each with a slice of toasted baguette and grated Gruyère.'),
  ('66666666-6666-6666-6666-666666666666', 6, 'Broil until cheese is bubbly and golden brown. Serve immediately.');

-- ============================================
-- RECIPE 7: Grilled Salmon
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '77777777-7777-7777-7777-777777777777'::uuid,
  id,
  'Grilled Salmon with Lemon Dill',
  'Perfectly grilled salmon fillet with a fresh lemon dill butter sauce',
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800',
  10, 15, 4, true
FROM public.categories WHERE slug = 'main-dishes';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('77777777-7777-7777-7777-777777777777', 4, '', 'salmon fillets (150g each)', 1),
  ('77777777-7777-7777-7777-777777777777', 4, 'tbsp', 'butter', 2),
  ('77777777-7777-7777-7777-777777777777', 2, '', 'lemons', 3),
  ('77777777-7777-7777-7777-777777777777', 3, 'tbsp', 'fresh dill', 4),
  ('77777777-7777-7777-7777-777777777777', 2, 'cloves', 'garlic', 5),
  ('77777777-7777-7777-7777-777777777777', 2, 'tbsp', 'olive oil', 6),
  ('77777777-7777-7777-7777-777777777777', 1, 'tsp', 'salt', 7),
  ('77777777-7777-7777-7777-777777777777', 1, 'tsp', 'black pepper', 8);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('77777777-7777-7777-7777-777777777777', 1, 'Pat salmon fillets dry and brush with olive oil. Season with salt and pepper.'),
  ('77777777-7777-7777-7777-777777777777', 2, 'Preheat grill to medium-high heat.'),
  ('77777777-7777-7777-7777-777777777777', 3, 'Grill salmon skin-side down for 4-5 minutes. Flip and cook another 3-4 minutes until cooked through.'),
  ('77777777-7777-7777-7777-777777777777', 4, 'Meanwhile, melt butter with minced garlic, juice of one lemon, and chopped dill.'),
  ('77777777-7777-7777-7777-777777777777', 5, 'Drizzle lemon dill butter over grilled salmon. Serve with lemon wedges.');

-- ============================================
-- RECIPE 8: Caesar Salad
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '88888888-8888-8888-8888-888888888888'::uuid,
  id,
  'Classic Caesar Salad',
  'Crisp romaine lettuce with homemade Caesar dressing, croutons, and shaved Parmesan',
  'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800',
  15, 10, 4, true
FROM public.categories WHERE slug = 'salads';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('88888888-8888-8888-8888-888888888888', 2, 'heads', 'romaine lettuce', 1),
  ('88888888-8888-8888-8888-888888888888', 100, 'g', 'Parmesan cheese', 2),
  ('88888888-8888-8888-8888-888888888888', 2, '', 'egg yolks', 3),
  ('88888888-8888-8888-8888-888888888888', 4, '', 'anchovy fillets', 4),
  ('88888888-8888-8888-8888-888888888888', 2, 'cloves', 'garlic', 5),
  ('88888888-8888-8888-8888-888888888888', 1, 'tbsp', 'Dijon mustard', 6),
  ('88888888-8888-8888-8888-888888888888', 2, 'tbsp', 'lemon juice', 7),
  ('88888888-8888-8888-8888-888888888888', 120, 'ml', 'olive oil', 8),
  ('88888888-8888-8888-8888-888888888888', 200, 'g', 'bread for croutons', 9);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('88888888-8888-8888-8888-888888888888', 1, 'Cut bread into cubes, toss with olive oil, and bake at 200°C until golden and crispy.'),
  ('88888888-8888-8888-8888-888888888888', 2, 'Mash anchovies and garlic into a paste. Whisk in egg yolks, mustard, and lemon juice.'),
  ('88888888-8888-8888-8888-888888888888', 3, 'Slowly drizzle in olive oil while whisking to create a creamy dressing.'),
  ('88888888-8888-8888-8888-888888888888', 4, 'Wash and chop romaine lettuce. Place in a large bowl.'),
  ('88888888-8888-8888-8888-888888888888', 5, 'Toss lettuce with dressing, croutons, and shaved Parmesan. Serve immediately.');

-- ============================================
-- RECIPE 9: Mushroom Risotto
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  '99999999-9999-9999-9999-999999999999'::uuid,
  id,
  'Creamy Mushroom Risotto',
  'Luxuriously creamy Italian risotto with mixed wild mushrooms and Parmesan',
  'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800',
  10, 35, 4, true
FROM public.categories WHERE slug = 'main-dishes';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('99999999-9999-9999-9999-999999999999', 300, 'g', 'arborio rice', 1),
  ('99999999-9999-9999-9999-999999999999', 400, 'g', 'mixed mushrooms', 2),
  ('99999999-9999-9999-9999-999999999999', 1, 'liter', 'vegetable broth', 3),
  ('99999999-9999-9999-9999-999999999999', 150, 'ml', 'dry white wine', 4),
  ('99999999-9999-9999-9999-999999999999', 1, '', 'shallot', 5),
  ('99999999-9999-9999-9999-999999999999', 80, 'g', 'Parmesan cheese', 6),
  ('99999999-9999-9999-9999-999999999999', 3, 'tbsp', 'butter', 7),
  ('99999999-9999-9999-9999-999999999999', 2, 'tbsp', 'olive oil', 8),
  ('99999999-9999-9999-9999-999999999999', 2, 'sprigs', 'fresh thyme', 9);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('99999999-9999-9999-9999-999999999999', 1, 'Heat broth in a saucepan and keep warm. Clean and slice mushrooms.'),
  ('99999999-9999-9999-9999-999999999999', 2, 'Sauté mushrooms in butter until golden. Remove and set aside.'),
  ('99999999-9999-9999-9999-999999999999', 3, 'In the same pan, sauté diced shallot in olive oil until soft.'),
  ('99999999-9999-9999-9999-999999999999', 4, 'Add rice and toast for 2 minutes. Add wine and stir until absorbed.'),
  ('99999999-9999-9999-9999-999999999999', 5, 'Add warm broth one ladle at a time, stirring constantly, waiting until each addition is absorbed.'),
  ('99999999-9999-9999-9999-999999999999', 6, 'After about 18 minutes, fold in mushrooms, butter, and Parmesan. Season and serve.');

-- ============================================
-- RECIPE 10: Minestrone Soup
-- ============================================
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  id,
  'Hearty Minestrone Soup',
  'A classic Italian vegetable soup packed with beans, pasta, and seasonal vegetables',
  'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=800',
  20, 40, 6, true
FROM public.categories WHERE slug = 'soups';

INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 400, 'g', 'canned cannellini beans', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 400, 'g', 'canned diced tomatoes', 2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '', 'carrots', 3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 'stalks', 'celery', 4),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '', 'zucchini', 5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 200, 'g', 'green beans', 6),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100, 'g', 'small pasta', 7),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1.5, 'liters', 'vegetable broth', 8),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 'cloves', 'garlic', 9),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '', 'onion', 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 50, 'g', 'Parmesan rind', 11);

INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Dice onion, carrots, celery, and zucchini. Mince garlic. Cut green beans into pieces.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 'Sauté onion, carrots, and celery in olive oil for 5 minutes.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 'Add garlic and cook for 1 minute.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4, 'Add tomatoes, broth, and Parmesan rind. Bring to a boil, then simmer for 15 minutes.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, 'Add zucchini, green beans, beans, and pasta. Cook until pasta is tender, about 10 minutes.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 6, 'Remove Parmesan rind, season with salt and pepper. Serve with extra Parmesan on top.');

