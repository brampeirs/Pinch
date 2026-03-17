import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { Tables } from '../../models/database.types';
import { getDisplayImage } from '../../utils/placeholder';

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
    sectionName: string | null;
}

interface RecipeStep {
    step: number;
    description: string;
    sectionName: string | null;
}

// Grouped by section for display
interface IngredientSection {
    name: string | null; // null = no section header
    ingredients: Ingredient[];
}

interface StepSection {
    name: string | null;
    steps: RecipeStep[];
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
    ingredientSections: IngredientSection[];
    stepSections: StepSection[];
}

@Component({
    selector: 'app-recipe-detail',
    imports: [RouterLink],
    templateUrl: './recipe-detail.html',
    styleUrl: './recipe-detail.scss',
})
export class RecipeDetailPage implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private supabase = inject(SupabaseService);

    servings = signal(2);
    recipe = signal<RecipeDetail | null>(null);
    loading = signal(true);
    error = signal<string | null>(null);
    deleting = signal(false);
    showDeleteConfirm = signal(false);

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

            // Map ingredients with section info
            const ingredients: Ingredient[] = (recipeData.ingredients || [])
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((ing) => ({
                    amount: Number(ing.amount) || 0,
                    unit: ing.unit || '',
                    name: ing.name,
                    sectionName: ing.section_name,
                }));

            // Map steps with section info
            const steps: RecipeStep[] = (recipeData.recipe_steps || [])
                .sort((a, b) => (a.step_number || 0) - (b.step_number || 0))
                .map((step) => ({
                    step: step.step_number || 0,
                    description: step.description,
                    sectionName: step.section_name,
                }));

            // Group ingredients by section (preserving order)
            const ingredientSections: IngredientSection[] = this.groupBySection(ingredients, (i) => i.sectionName).map(
                (section) => ({
                    name: section.name,
                    ingredients: section.items,
                }),
            );

            // Group steps by section (preserving order)
            const stepSections: StepSection[] = this.groupBySection(steps, (s) => s.sectionName).map((section) => ({
                name: section.name,
                steps: section.items,
            }));

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
                ingredients,
                steps,
                ingredientSections,
                stepSections,
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

    /** Returns the image URL or a category-specific placeholder */
    displayImage = computed(() => {
        const r = this.recipe();
        if (!r) return '/placeholders/default.svg';
        return getDisplayImage(r.imageUrl, r.category);
    });

    /** Ingredients adjusted for current servings, grouped by section */
    adjustedIngredientSections = computed(() => {
        const r = this.recipe();
        if (!r) return [];
        const ratio = this.servings() / r.servings;

        return r.ingredientSections.map((section) => ({
            name: section.name,
            ingredients: section.ingredients.map((ing) => ({
                ...ing,
                amount: Math.round(ing.amount * ratio * 10) / 10,
            })),
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

    editRecipe() {
        const r = this.recipe();
        if (r) {
            this.router.navigate(['/recipes', r.id, 'edit']);
        }
    }

    confirmDelete() {
        this.showDeleteConfirm.set(true);
    }

    cancelDelete() {
        this.showDeleteConfirm.set(false);
    }

    async deleteRecipe() {
        const r = this.recipe();
        if (!r) return;

        this.deleting.set(true);
        const { error } = await this.supabase.deleteRecipe(r.id);

        if (error) {
            this.error.set('Verwijderen mislukt: ' + error.message);
            this.deleting.set(false);
            this.showDeleteConfirm.set(false);
            return;
        }

        this.router.navigate(['/']);
    }

    /**
     * Groups items by section name while preserving their original order.
     * Items with the same section_name are grouped together in the order they appear.
     */
    private groupBySection<T>(
        items: T[],
        getSectionName: (item: T) => string | null,
    ): { name: string | null; items: T[] }[] {
        const sections: { name: string | null; items: T[] }[] = [];
        const sectionMap = new Map<string | null, T[]>();

        for (const item of items) {
            const sectionName = getSectionName(item);
            if (!sectionMap.has(sectionName)) {
                sectionMap.set(sectionName, []);
                sections.push({ name: sectionName, items: sectionMap.get(sectionName)! });
            }
            sectionMap.get(sectionName)!.push(item);
        }

        return sections;
    }
}
