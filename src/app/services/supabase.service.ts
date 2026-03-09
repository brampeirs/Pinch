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

    return { data: recipeData, error: null };
  }

  // ============ AI PARSING ============
  async parseRecipeText(
    text: string,
    type: 'ingredients' | 'steps'
  ): Promise<{
    items: { name: string; amount: number | null; unit: string }[] | { description: string }[];
    error: string | null;
  }> {
    const { data, error } = await this.supabase.functions.invoke('parse-recipe', {
      body: { text, type },
    });

    if (error) {
      return { items: [], error: error.message };
    }

    if (data.error) {
      return { items: [], error: data.error };
    }

    return { items: data.items || [], error: null };
  }
}
