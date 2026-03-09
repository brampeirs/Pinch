import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { Tables } from '../../models/database.types';

// Database types
type DbRecipe = Tables<'recipes'>;
type DbCategory = Tables<'categories'>;
type DbIngredient = Tables<'ingredients'>;
type DbStep = Tables<'recipe_steps'>;

// Extended recipe with joined data
interface RecipeWithDetails extends DbRecipe {
  category: DbCategory | null;
  ingredients: DbIngredient[];
  recipe_steps: DbStep[];
}

// UI-friendly interfaces
interface Ingredient {
  amount: number;
  unit: string;
  name: string;
}

interface RecipeStep {
  step: number;
  description: string;
}

interface RecipeDetail {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.scss',
})
export class RecipeDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private supabase = inject(SupabaseService);

  servings = signal(2);
  recipe = signal<RecipeDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadRecipe(id);
    } else {
      this.error.set('Geen recept ID gevonden.');
      this.loading.set(false);
    }
  }

  private async loadRecipe(id: string) {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabase.getRecipeById(id);

      if (error) throw error;
      if (!data) throw new Error('Recept niet gevonden');

      const recipeData = data as RecipeWithDetails;

      // Map database recipe to UI format
      const mappedRecipe: RecipeDetail = {
        id: recipeData.id,
        title: recipeData.title,
        description: recipeData.description || '',
        imageUrl: recipeData.image_url || '',
        category: recipeData.category?.name || '',
        prepTime: recipeData.prep_time || 0,
        cookTime: recipeData.cook_time || 0,
        servings: recipeData.servings || 2,
        ingredients: (recipeData.ingredients || [])
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((ing) => ({
            amount: Number(ing.amount) || 0,
            unit: ing.unit || '',
            name: ing.name,
          })),
        steps: (recipeData.recipe_steps || [])
          .sort((a, b) => (a.step_number || 0) - (b.step_number || 0))
          .map((step) => ({
            step: step.step_number || 0,
            description: step.description,
          })),
      };

      this.recipe.set(mappedRecipe);
      this.servings.set(mappedRecipe.servings);
    } catch (err) {
      console.error('Error loading recipe:', err);
      this.error.set('Er ging iets mis bij het laden van het recept.');
    } finally {
      this.loading.set(false);
    }
  }

  totalTime = computed(() => {
    const r = this.recipe();
    return r ? r.prepTime + r.cookTime : 0;
  });

  adjustedIngredients = computed(() => {
    const r = this.recipe();
    if (!r) return [];
    const ratio = this.servings() / r.servings;
    return r.ingredients.map((ing) => ({
      ...ing,
      amount: Math.round(ing.amount * ratio * 10) / 10,
    }));
  });

  decreaseServings() {
    if (this.servings() > 1) {
      this.servings.update((v) => v - 1);
    }
  }

  increaseServings() {
    this.servings.update((v) => v + 1);
  }
}
