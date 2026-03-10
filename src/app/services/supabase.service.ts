import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from '../models/database.types';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase = createClient<Database>(environment.supabase.url, environment.supabase.anonKey);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  // ============ AUTH ============
  async signUp(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  async getSession() {
    return this.supabase.auth.getSession();
  }

  // ============ RECIPES ============
  async getRecipes() {
    return this.supabase
      .from('recipes')
      .select(
        `
        *,
        category:categories(*),
        user:users(id, name, avatar_url)
      `
      )
      .eq('is_published', true)
      .order('created_at', { ascending: false });
  }

  async getRecipeById(id: string) {
    return this.supabase
      .from('recipes')
      .select(
        `
        *,
        category:categories(*),
        user:users(id, name, avatar_url),
        ingredients(*),
        recipe_steps(*)
      `
      )
      .eq('id', id)
      .single();
  }

  async getRecipesByCategory(categorySlug: string) {
    return this.supabase
      .from('recipes')
      .select(
        `
        *,
        category:categories!inner(*)
      `
      )
      .eq('categories.slug', categorySlug)
      .eq('is_published', true);
  }

  // ============ CATEGORIES ============
  async getCategories() {
    return this.supabase.from('categories').select('*').order('name');
  }

  // ============ FAVORITES ============
  async getFavorites(userId: string) {
    return this.supabase
      .from('favorites')
      .select(
        `
        *,
        recipe:recipes(*, category:categories(*))
      `
      )
      .eq('user_id', userId);
  }

  async addFavorite(userId: string, recipeId: string) {
    return this.supabase.from('favorites').insert({ user_id: userId, recipe_id: recipeId });
  }

  async removeFavorite(userId: string, recipeId: string) {
    return this.supabase.from('favorites').delete().eq('user_id', userId).eq('recipe_id', recipeId);
  }

  // ============ STORAGE ============
  async uploadRecipeImage(file: File): Promise<{ url: string | null; error: Error | null }> {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `recipes/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from('recipe-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { url: null, error: uploadError };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from('recipe-images').getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  }

  // ============ CREATE RECIPE ============
  async createRecipe(
    recipe: {
      title: string;
      description?: string;
      category_id?: string;
      image_url?: string;
      prep_time?: number;
      cook_time?: number;
      servings?: number;
      is_published?: boolean;
    },
    ingredients: { name: string; amount?: number; unit?: string; sort_order?: number }[],
    steps: { step_number: number; description: string }[]
  ) {
    // Insert the recipe first
    const { data: recipeData, error: recipeError } = await this.supabase
      .from('recipes')
      .insert({
        title: recipe.title,
        description: recipe.description,
        category_id: recipe.category_id,
        image_url: recipe.image_url,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        is_published: recipe.is_published ?? true,
      })
      .select()
      .single();

    if (recipeError || !recipeData) {
      return { data: null, error: recipeError };
    }

    // Insert ingredients
    if (ingredients.length > 0) {
      const ingredientsToInsert = ingredients.map((ing, index) => ({
        recipe_id: recipeData.id,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        sort_order: ing.sort_order ?? index,
      }));

      const { error: ingredientsError } = await this.supabase
        .from('ingredients')
        .insert(ingredientsToInsert);

      if (ingredientsError) {
        // Rollback: delete the recipe
        await this.supabase.from('recipes').delete().eq('id', recipeData.id);
        return { data: null, error: ingredientsError };
      }
    }

    // Insert steps
    if (steps.length > 0) {
      const stepsToInsert = steps.map((step) => ({
        recipe_id: recipeData.id,
        step_number: step.step_number,
        description: step.description,
      }));

      const { error: stepsError } = await this.supabase.from('recipe_steps').insert(stepsToInsert);

      if (stepsError) {
        // Rollback: delete ingredients and recipe
        await this.supabase.from('ingredients').delete().eq('recipe_id', recipeData.id);
        await this.supabase.from('recipes').delete().eq('id', recipeData.id);
        return { data: null, error: stepsError };
      }
    }

    // Trigger embedding generation (fire and forget - don't block recipe creation)
    this.embedRecipe(recipeData.id).catch((err) => {
      console.warn('Failed to embed recipe:', err);
    });

    return { data: recipeData, error: null };
  }

  // ============ UPDATE RECIPE ============
  async updateRecipe(
    recipeId: string,
    recipe: {
      title: string;
      description?: string;
      category_id?: string;
      image_url?: string;
      prep_time?: number;
      cook_time?: number;
      servings?: number;
      is_published?: boolean;
    },
    ingredients: { name: string; amount?: number; unit?: string; sort_order?: number }[],
    steps: { step_number: number; description: string }[]
  ) {
    // Update the recipe
    const { data: recipeData, error: recipeError } = await this.supabase
      .from('recipes')
      .update({
        title: recipe.title,
        description: recipe.description,
        category_id: recipe.category_id,
        image_url: recipe.image_url,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        is_published: recipe.is_published ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId)
      .select()
      .single();

    if (recipeError || !recipeData) {
      return { data: null, error: recipeError };
    }

    // Delete existing ingredients and insert new ones
    await this.supabase.from('ingredients').delete().eq('recipe_id', recipeId);

    if (ingredients.length > 0) {
      const ingredientsToInsert = ingredients.map((ing, index) => ({
        recipe_id: recipeId,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        sort_order: ing.sort_order ?? index,
      }));

      const { error: ingredientsError } = await this.supabase
        .from('ingredients')
        .insert(ingredientsToInsert);

      if (ingredientsError) {
        return { data: null, error: ingredientsError };
      }
    }

    // Delete existing steps and insert new ones
    await this.supabase.from('recipe_steps').delete().eq('recipe_id', recipeId);

    if (steps.length > 0) {
      const stepsToInsert = steps.map((step) => ({
        recipe_id: recipeId,
        step_number: step.step_number,
        description: step.description,
      }));

      const { error: stepsError } = await this.supabase.from('recipe_steps').insert(stepsToInsert);

      if (stepsError) {
        return { data: null, error: stepsError };
      }
    }

    // Re-generate embedding (fire and forget)
    this.embedRecipe(recipeId).catch((err) => {
      console.warn('Failed to embed recipe:', err);
    });

    return { data: recipeData, error: null };
  }

  // ============ DELETE RECIPE ============
  async deleteRecipe(recipeId: string): Promise<{ error: Error | null }> {
    // First, get the recipe to check for image_url
    const { data: recipe, error: fetchError } = await this.supabase
      .from('recipes')
      .select('image_url')
      .eq('id', recipeId)
      .single();

    if (fetchError) {
      return { error: fetchError };
    }

    // Delete the image from storage if it exists
    if (recipe?.image_url) {
      const imagePath = this.extractImagePath(recipe.image_url);
      if (imagePath) {
        await this.supabase.storage.from('recipe-images').remove([imagePath]);
      }
    }

    // Delete the recipe (ingredients, steps, embeddings will cascade)
    const { error: deleteError } = await this.supabase.from('recipes').delete().eq('id', recipeId);

    return { error: deleteError };
  }

  // Extract storage path from full URL
  private extractImagePath(imageUrl: string): string | null {
    // URL format: https://<project>.supabase.co/storage/v1/object/public/recipe-images/recipes/filename.jpg
    const match = imageUrl.match(/recipe-images\/(.+)$/);
    return match ? match[1] : null;
  }

  // ============ EMBEDDING ============
  async embedRecipe(recipeId: string): Promise<void> {
    const { error } = await this.supabase.functions.invoke('embed-recipe', {
      body: { recipe_id: recipeId },
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  // ============ SEMANTIC SEARCH ============
  async searchRecipes(
    messages: { role: 'user' | 'assistant'; content: string }[],
    matchCount: number = 5
  ): Promise<{
    success: boolean;
    intent?: 'search_recipes' | 'answer_question' | 'greeting' | 'unclear';
    message?: string;
    results: {
      id: string;
      title: string;
      description: string | null;
      image_url: string | null;
      category_name: string | null;
      similarity: number;
    }[];
    error?: string;
  }> {
    const { data, error } = await this.supabase.functions.invoke('search-recipes', {
      body: { messages, match_count: matchCount },
    });

    if (error) {
      return { success: false, results: [], error: error.message };
    }

    return data;
  }

  // ============ AI PARSING (STREAMING) ============
  async *parseRecipeTextStream(
    text: string,
    type: 'ingredients' | 'steps'
  ): AsyncGenerator<{ delta?: string; done?: boolean; error?: string }> {
    const url = `${environment.supabase.url}/functions/v1/parse-recipe`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: environment.supabase.anonKey,
      },
      body: JSON.stringify({ text, type }),
    });

    if (!response.ok) {
      yield { error: `HTTP error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE messages
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              yield { error: parsed.error };
              return;
            }
            if (parsed.delta) {
              yield { delta: parsed.delta };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}
