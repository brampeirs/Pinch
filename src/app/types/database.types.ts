// Database types for Supabase
// These match the database schema

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  description: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time: number;
  cook_time: number;
  servings: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ingredient {
  id: string;
  recipe_id: string;
  amount: number;
  unit: string;
  name: string;
  sort_order: number;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  step_number: number;
  description: string;
  image_url: string | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  recipe_id: string;
  created_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  recipe_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

// ============ JOIN TYPES ============

export interface RecipeWithDetails extends Recipe {
  category: Category;
  user: Pick<User, 'id' | 'name' | 'avatar_url'>;
  ingredients: Ingredient[];
  recipe_steps: RecipeStep[];
}

export interface RecipeCard extends Recipe {
  category: Category;
}

export interface FavoriteWithRecipe extends Favorite {
  recipe: RecipeCard;
}
