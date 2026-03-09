-- ============================================
-- SEED DATA
-- ============================================

-- Insert categories
INSERT INTO public.categories (name, slug, emoji, description) VALUES
  ('Pasta', 'pasta', '🍝', 'Italiaanse pasta gerechten'),
  ('Soepen', 'soepen', '🍲', 'Warme en koude soepen'),
  ('Salades', 'salades', '🥗', 'Frisse salades'),
  ('Bowls', 'bowls', '🍜', 'Gezonde bowls'),
  ('Desserts', 'desserts', '🍰', 'Zoete desserts'),
  ('Ontbijt', 'ontbijt', '🍳', 'Ontbijtrecepten');

-- Insert sample recipes (without user_id for now)
INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT 
  '11111111-1111-1111-1111-111111111111'::uuid,
  id,
  'Pasta Carbonara',
  'Romige Italiaanse pasta met spek, ei en Parmezaanse kaas',
  'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
  10, 20, 2, true
FROM public.categories WHERE slug = 'pasta';

INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT 
  '22222222-2222-2222-2222-222222222222'::uuid,
  id,
  'Kip Teriyaki Bowl',
  'Malse kip in zoete teriyakisaus met rijst en groenten',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  15, 25, 2, true
FROM public.categories WHERE slug = 'bowls';

INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT 
  '33333333-3333-3333-3333-333333333333'::uuid,
  id,
  'Avocado Toast',
  'Krokant brood met romige avocado en een gepocheerd ei',
  'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800',
  5, 10, 1, true
FROM public.categories WHERE slug = 'ontbijt';

INSERT INTO public.recipes (id, category_id, title, description, image_url, prep_time, cook_time, servings, is_published)
SELECT 
  '44444444-4444-4444-4444-444444444444'::uuid,
  id,
  'Tom Kha Gai',
  'Thaise kokossoep met kip, galanga en citroengras',
  'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=800',
  15, 30, 4, true
FROM public.categories WHERE slug = 'soepen';

-- Insert ingredients for Pasta Carbonara
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 200, 'g', 'Spaghetti', 1),
  ('11111111-1111-1111-1111-111111111111', 100, 'g', 'Pancetta of spekblokjes', 2),
  ('11111111-1111-1111-1111-111111111111', 2, 'stuks', 'Eigeel', 3),
  ('11111111-1111-1111-1111-111111111111', 50, 'g', 'Parmezaanse kaas', 4),
  ('11111111-1111-1111-1111-111111111111', 1, 'teen', 'Knoflook', 5),
  ('11111111-1111-1111-1111-111111111111', 1, 'el', 'Olijfolie', 6);

-- Insert steps for Pasta Carbonara
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 1, 'Kook de spaghetti volgens de verpakking in ruim gezouten water.'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Bak de pancetta in een koekenpan met olijfolie tot het krokant is.'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Klop de eidooiers los met de Parmezaanse kaas en peper.'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Giet de pasta af en bewaar een kopje pastawater.'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Haal de pan van het vuur en roer het ei-kaasmengsel erdoor.');

-- Insert ingredients for Kip Teriyaki Bowl
INSERT INTO public.ingredients (recipe_id, amount, unit, name, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222222', 300, 'g', 'Kipfilet', 1),
  ('22222222-2222-2222-2222-222222222222', 150, 'g', 'Rijst', 2),
  ('22222222-2222-2222-2222-222222222222', 3, 'el', 'Teriyakisaus', 3),
  ('22222222-2222-2222-2222-222222222222', 1, 'stuk', 'Komkommer', 4),
  ('22222222-2222-2222-2222-222222222222', 1, 'stuk', 'Wortel', 5);

-- Insert steps for Kip Teriyaki Bowl
INSERT INTO public.recipe_steps (recipe_id, step_number, description) VALUES
  ('22222222-2222-2222-2222-222222222222', 1, 'Kook de rijst volgens de verpakking.'),
  ('22222222-2222-2222-2222-222222222222', 2, 'Snijd de kip in blokjes en bak goudbruin.'),
  ('22222222-2222-2222-2222-222222222222', 3, 'Voeg de teriyakisaus toe en laat 2 minuten inkoken.'),
  ('22222222-2222-2222-2222-222222222222', 4, 'Serveer de kip op de rijst met verse groenten.');

