-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ============ USERS POLICIES ============
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ============ CATEGORIES POLICIES ============
CREATE POLICY "Anyone can view categories" ON public.categories
  FOR SELECT USING (true);

-- ============ RECIPES POLICIES ============
CREATE POLICY "Anyone can view published recipes" ON public.recipes
  FOR SELECT USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create recipes" ON public.recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes" ON public.recipes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes" ON public.recipes
  FOR DELETE USING (auth.uid() = user_id);

-- ============ INGREDIENTS POLICIES ============
CREATE POLICY "Anyone can view ingredients of visible recipes" ON public.ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = ingredients.recipe_id 
      AND (recipes.is_published = true OR recipes.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage ingredients of own recipes" ON public.ingredients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = ingredients.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

-- ============ RECIPE STEPS POLICIES ============
CREATE POLICY "Anyone can view steps of visible recipes" ON public.recipe_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = recipe_steps.recipe_id 
      AND (recipes.is_published = true OR recipes.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage steps of own recipes" ON public.recipe_steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.recipes 
      WHERE recipes.id = recipe_steps.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

-- ============ FAVORITES POLICIES ============
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON public.favorites
  FOR ALL USING (auth.uid() = user_id);

-- ============ RATINGS POLICIES ============
CREATE POLICY "Anyone can view ratings" ON public.ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own ratings" ON public.ratings
  FOR ALL USING (auth.uid() = user_id);

-- ============ CHAT POLICIES ============
CREATE POLICY "Users can view own conversations" ON public.chat_conversations
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create conversations" ON public.chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view messages in own conversations" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations 
      WHERE chat_conversations.id = chat_messages.conversation_id 
      AND (chat_conversations.user_id = auth.uid() OR chat_conversations.user_id IS NULL)
    )
  );

CREATE POLICY "Users can create messages in own conversations" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations 
      WHERE chat_conversations.id = chat_messages.conversation_id 
      AND (chat_conversations.user_id = auth.uid() OR chat_conversations.user_id IS NULL)
    )
  );

