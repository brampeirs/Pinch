import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

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
export class RecipeDetailPage {
  private route = inject(ActivatedRoute);

  servings = signal(2);

  // Mock data - will be replaced with Supabase later
  recipe = signal<RecipeDetail>({
    id: '1',
    title: 'Pasta Carbonara',
    description:
      'De klassieke Italiaanse pasta met een romige saus van ei, Parmezaanse kaas en krokant gebakken spek. Eenvoudig maar onweerstaanbaar lekker.',
    imageUrl:
      'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=1200',
    category: 'Pasta',
    prepTime: 10,
    cookTime: 20,
    servings: 2,
    ingredients: [
      { amount: 200, unit: 'g', name: 'Spaghetti' },
      { amount: 100, unit: 'g', name: 'Pancetta of spekblokjes' },
      { amount: 2, unit: 'x', name: 'Eigeel' },
      { amount: 50, unit: 'g', name: 'Parmezaanse kaas' },
      { amount: 1, unit: 'teen', name: 'Knoflook' },
      { amount: 1, unit: 'el', name: 'Olijfolie' },
      { amount: 1, unit: 'snuf', name: 'Zwarte peper' },
    ],
    steps: [
      {
        step: 1,
        description:
          'Kook de spaghetti volgens de verpakking in ruim gezouten water.',
      },
      {
        step: 2,
        description:
          'Bak de pancetta in een koekenpan met olijfolie tot het krokant is. Voeg de knoflook toe en bak 1 minuut mee.',
      },
      {
        step: 3,
        description:
          'Klop de eidooiers los met de Parmezaanse kaas en peper in een kom.',
      },
      {
        step: 4,
        description:
          'Giet de pasta af en bewaar een kopje pastawater. Voeg de pasta toe aan de pan met pancetta.',
      },
      {
        step: 5,
        description:
          'Haal de pan van het vuur en roer het ei-kaasmengsel erdoor. Voeg pastawater toe voor een romige saus. Direct serveren!',
      },
    ],
  });

  totalTime = computed(
    () => this.recipe().prepTime + this.recipe().cookTime
  );

  adjustedIngredients = computed(() => {
    const ratio = this.servings() / this.recipe().servings;
    return this.recipe().ingredients.map((ing) => ({
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
