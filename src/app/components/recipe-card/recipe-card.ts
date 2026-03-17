import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tables } from '../../models/database.types';
import { getDisplayImage } from '../../utils/placeholder';

// Database types using generated types
type DbRecipe = Tables<'recipes'>;
type DbCategory = Tables<'categories'>;

// Extended recipe with joined category
export interface RecipeWithCategory extends DbRecipe {
  category: DbCategory | null;
}

// UI-friendly recipe interface (mapped from database)
export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  prepTime: number;
  cookTime: number;
}

// Helper to map database recipe to UI recipe
export function mapRecipeToUI(recipe: RecipeWithCategory): Recipe {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description || '',
    imageUrl: recipe.image_url || '',
    category: recipe.category?.name || '',
    prepTime: recipe.prep_time || 0,
    cookTime: recipe.cook_time || 0,
  };
}

@Component({
  selector: 'app-recipe-card',
  imports: [RouterLink],
  templateUrl: './recipe-card.html',
  styleUrl: './recipe-card.scss',
})
export class RecipeCard {
  recipe = input.required<Recipe>();

  /** Returns the image URL or a category-specific placeholder */
  displayImage = computed(() => {
    const r = this.recipe();
    return getDisplayImage(r.imageUrl, r.category);
  });
}
