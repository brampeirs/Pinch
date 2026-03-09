import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

interface IngredientForm {
  name: string;
  amount: number | null;
  unit: string;
}

interface StepForm {
  description: string;
}

@Component({
  selector: 'app-add-recipe',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './add-recipe.html',
})
export class AddRecipePage {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  // Form state
  title = signal('');
  description = signal('');
  categoryId = signal('');
  imageUrl = signal('');
  prepTime = signal<number | null>(null);
  cookTime = signal<number | null>(null);
  servings = signal<number | null>(4);

  // Image upload state
  imageFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  uploadingImage = signal(false);

  // Dynamic lists
  ingredients = signal<IngredientForm[]>([{ name: '', amount: null, unit: '' }]);
  steps = signal<StepForm[]>([{ description: '' }]);

  // Categories from DB
  categories = signal<{ id: string; name: string; emoji: string | null }[]>([]);

  // UI state
  saving = signal(false);
  error = signal<string | null>(null);

  // AI Parser state
  rawIngredientsText = signal('');
  rawStepsText = signal('');
  parsingIngredients = signal(false);
  parsingSteps = signal(false);

  constructor() {
    this.loadCategories();
  }

  async loadCategories() {
    const { data } = await this.supabase.getCategories();
    if (data) {
      this.categories.set(data);
    }
  }

  addIngredient() {
    this.ingredients.update((list) => [...list, { name: '', amount: null, unit: '' }]);
  }

  removeIngredient(index: number) {
    this.ingredients.update((list) => list.filter((_, i) => i !== index));
  }

  updateIngredient(index: number, field: keyof IngredientForm, value: string | number | null) {
    this.ingredients.update((list) => {
      const updated = [...list];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  addStep() {
    this.steps.update((list) => [...list, { description: '' }]);
  }

  removeStep(index: number) {
    this.steps.update((list) => list.filter((_, i) => i !== index));
  }

  updateStep(index: number, value: string) {
    this.steps.update((list) => {
      const updated = [...list];
      updated[index] = { description: value };
      return updated;
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.imageFile.set(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.imageUrl.set('');
  }

  async parseIngredients() {
    const text = this.rawIngredientsText().trim();
    if (!text) return;

    this.parsingIngredients.set(true);
    this.error.set(null);

    const { items, error } = await this.supabase.parseRecipeText(text, 'ingredients');

    this.parsingIngredients.set(false);

    if (error) {
      this.error.set('Parsen mislukt: ' + error);
      return;
    }

    if (items.length > 0) {
      const parsedIngredients = items as { name: string; amount: number | null; unit: string }[];
      this.ingredients.set(parsedIngredients);
      this.rawIngredientsText.set('');
    }
  }

  async parseSteps() {
    const text = this.rawStepsText().trim();
    if (!text) return;

    this.parsingSteps.set(true);
    this.error.set(null);

    const { items, error } = await this.supabase.parseRecipeText(text, 'steps');

    this.parsingSteps.set(false);

    if (error) {
      this.error.set('Parsen mislukt: ' + error);
      return;
    }

    if (items.length > 0) {
      const parsedSteps = items as { description: string }[];
      this.steps.set(parsedSteps);
      this.rawStepsText.set('');
    }
  }

  async saveRecipe() {
    // Validation
    if (!this.title().trim()) {
      this.error.set('Vul een titel in');
      return;
    }

    const validIngredients = this.ingredients().filter((i) => i.name.trim());
    const validSteps = this.steps().filter((s) => s.description.trim());

    if (validIngredients.length === 0) {
      this.error.set('Voeg minstens één ingrediënt toe');
      return;
    }

    if (validSteps.length === 0) {
      this.error.set('Voeg minstens één bereidingsstap toe');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    // Upload image first if there's a file
    let finalImageUrl = this.imageUrl();
    if (this.imageFile()) {
      this.uploadingImage.set(true);
      const { url, error: uploadError } = await this.supabase.uploadRecipeImage(this.imageFile()!);
      this.uploadingImage.set(false);

      if (uploadError) {
        this.saving.set(false);
        this.error.set('Afbeelding uploaden mislukt: ' + uploadError.message);
        return;
      }
      finalImageUrl = url || '';
    }

    const { data, error } = await this.supabase.createRecipe(
      {
        title: this.title(),
        description: this.description() || undefined,
        category_id: this.categoryId() || undefined,
        image_url: finalImageUrl || undefined,
        prep_time: this.prepTime() ?? undefined,
        cook_time: this.cookTime() ?? undefined,
        servings: this.servings() ?? undefined,
        is_published: true,
      },
      validIngredients.map((i, idx) => ({
        name: i.name,
        amount: i.amount ?? undefined,
        unit: i.unit || undefined,
        sort_order: idx,
      })),
      validSteps.map((s, idx) => ({
        step_number: idx + 1,
        description: s.description,
      }))
    );

    this.saving.set(false);

    if (error) {
      this.error.set('Er ging iets mis: ' + error.message);
      return;
    }

    if (data) {
      this.router.navigate(['/recipes', data.id]);
    }
  }
}
