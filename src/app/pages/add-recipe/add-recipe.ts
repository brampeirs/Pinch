import { StructuredObject } from '@ai-sdk/angular';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    computed,
    effect,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { z } from 'zod';
import { SupabaseService } from '../../services/supabase.service';

const parsedIngredientSchema = z.object({
    name: z.string(),
    amount: z.number().nullable(),
    unit: z.string(),
    section_name: z.string().nullable(),
    note: z.string().nullable().optional(),
});

const parsedIngredientsSchema = z.object({
    items: z.array(parsedIngredientSchema),
});

const parsedStepSchema = z.object({
    description: z.string(),
    section_name: z.string().nullable(),
});

const parsedStepsSchema = z.object({
    items: z.array(parsedStepSchema),
});

type ParsedIngredientResult = z.infer<typeof parsedIngredientSchema>;
type ParsedIngredientsResult = z.infer<typeof parsedIngredientsSchema>;
type ParsedStepResult = z.infer<typeof parsedStepSchema>;
type ParsedStepsResult = z.infer<typeof parsedStepsSchema>;

interface ParseIngredientsRequest {
    text: string;
    type: 'ingredients';
}

interface ParseStepsRequest {
    text: string;
    type: 'steps';
}

interface IngredientForm {
    name: string;
    amount: number | null;
    unit: string;
    note?: string | null;
    section_name?: string | null;
}

interface StepForm {
    description: string;
    section_name?: string | null;
}

@Component({
    selector: 'app-add-recipe',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './add-recipe.html',
})
export class AddRecipePage implements OnInit {
    private readonly supabase = inject(SupabaseService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);
    private readonly ingredientsParser = new StructuredObject<
        typeof parsedIngredientsSchema,
        ParsedIngredientsResult,
        ParseIngredientsRequest
    >({
        api: 'parse-recipe',
        schema: parsedIngredientsSchema,
        fetch: this.supabase.parseRecipeStreamFetch,
        onError: (error) => {
            this.error.set(this.formatParserError(error));
        },
        onFinish: ({ object, error }) => {
            if (error || !object) {
                this.error.set(this.formatParserError(error));
                return;
            }

            this.ingredients.set(object.items.map((ingredient) => this.toIngredientForm(ingredient)));
            this.error.set(null);
            this.rawIngredientsText.set('');
        },
    });
    private readonly stepsParser = new StructuredObject<typeof parsedStepsSchema, ParsedStepsResult, ParseStepsRequest>(
        {
            api: 'parse-recipe',
            schema: parsedStepsSchema,
            fetch: this.supabase.parseRecipeStreamFetch,
            onError: (error) => {
                this.error.set(this.formatParserError(error));
            },
            onFinish: ({ object, error }) => {
                if (error || !object) {
                    this.error.set(this.formatParserError(error));
                    return;
                }

                this.steps.set(object.items.map((step) => this.toStepForm(step)));
                this.error.set(null);
                this.rawStepsText.set('');
            },
        },
    );

    // Edit mode
    isEditMode = signal(false);
    recipeId = signal<string | null>(null);
    loading = signal(false);

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
    ingredients = signal<IngredientForm[]>([{ name: '', amount: null, unit: '', note: '' }]);
    steps = signal<StepForm[]>([{ description: '' }]);

    // Categories from DB
    categories = signal<{ id: string; name: string; emoji: string | null }[]>([]);

    // UI state
    saving = signal(false);
    error = signal<string | null>(null);

    // AI Parser state
    rawIngredientsText = signal('');
    rawStepsText = signal('');
    parsingIngredients = computed(() => this.ingredientsParser.loading);
    parsingSteps = computed(() => this.stepsParser.loading);
    canParseIngredients = computed(() => !this.parsingIngredients() && this.rawIngredientsText().trim().length > 0);
    canParseSteps = computed(() => !this.parsingSteps() && this.rawStepsText().trim().length > 0);

    backLink = computed(() =>
        this.isEditMode() && this.recipeId() ? ['/recipes', this.recipeId()!] : ['/recipes/new'],
    );
    backLabel = computed(() => (this.isEditMode() ? 'Back to recipe' : 'Back to options'));
    pageTitle = computed(() => (this.isEditMode() ? 'Edit recipe' : 'Write or paste recipe'));
    pageDescription = computed(() =>
        this.isEditMode() ? 'Update your recipe' : 'Start from scratch or paste recipe text into the helpers below.',
    );
    selectedCategory = computed(() => this.categories().find((category) => category.id === this.categoryId()) ?? null);
    selectedCategoryLabel = computed(() => {
        const category = this.selectedCategory();

        if (!category) {
            return 'Choose a category';
        }

        return `${category.emoji ? `${category.emoji} ` : ''}${category.name}`;
    });
    totalTimeLabel = computed(() => {
        const total = (this.prepTime() ?? 0) + (this.cookTime() ?? 0);
        return total > 0 ? `${total} min total` : 'Add timing';
    });
    servingsLabel = computed(() => `${this.servings() ?? 4} servings`);
    displayTitle = computed(() => {
        const title = this.title().trim();
        return title || (this.isEditMode() ? 'Edit recipe' : 'Your recipe title');
    });
    displayDescription = computed(() => {
        const description = this.description().trim();

        if (description) {
            return description;
        }

        return 'Short description of the recipe...';
    });
    coverButtonLabel = computed(() => {
        if (this.uploadingImage()) {
            return 'Uploading cover image...';
        }

        return this.imagePreview() ? 'Change cover image' : 'Upload cover image';
    });

    constructor() {
        effect(() => {
            const items = this.ingredientsParser.object?.items;

            if (!items) {
                return;
            }

            this.ingredients.set(items.map((ingredient) => this.toIngredientForm(ingredient)));
        });

        effect(() => {
            const items = this.stepsParser.object?.items;

            if (!items) {
                return;
            }

            this.steps.set(items.map((step) => this.toStepForm(step)));
        });

        this.destroyRef.onDestroy(() => {
            this.ingredientsParser.stop();
            this.stepsParser.stop();
        });
    }

    ngOnInit() {
        this.loadCategories();

        // Check if we're in edit mode
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode.set(true);
            this.recipeId.set(id);
            this.loadRecipe(id);
        }
    }

    async loadRecipe(id: string) {
        this.loading.set(true);
        this.error.set(null);

        const { data, error } = await this.supabase.getRecipeById(id);

        if (error || !data) {
            this.error.set('Recept niet gevonden');
            this.loading.set(false);
            return;
        }

        // Populate form with existing data
        this.title.set(data.title);
        this.description.set(data.description || '');
        this.categoryId.set(data.category_id || '');
        this.imageUrl.set(data.image_url || '');
        this.prepTime.set(data.prep_time || null);
        this.cookTime.set(data.cook_time || null);
        this.servings.set(data.servings || 4);

        // Set image preview if there's an existing image
        if (data.image_url) {
            this.imagePreview.set(data.image_url);
        }

        // Load ingredients
        if (data.ingredients && data.ingredients.length > 0) {
            const sortedIngredients = [...data.ingredients].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            this.ingredients.set(
                sortedIngredients.map((ing) => ({
                    name: ing.name,
                    amount: ing.amount ? Number(ing.amount) : null,
                    unit: ing.unit || '',
                    note: ing.note || '',
                    section_name: ing.section_name,
                })),
            );
        }

        // Load steps
        if (data.recipe_steps && data.recipe_steps.length > 0) {
            const sortedSteps = [...data.recipe_steps].sort((a, b) => (a.step_number || 0) - (b.step_number || 0));
            this.steps.set(
                sortedSteps.map((step) => ({
                    description: step.description,
                    section_name: step.section_name,
                })),
            );
        }

        this.loading.set(false);
    }

    async loadCategories() {
        const { data } = await this.supabase.getCategories();
        if (data) {
            this.categories.set(data);
        }
    }

    addIngredient() {
        this.ingredients.update((list) => [...list, { name: '', amount: null, unit: '', note: '' }]);
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
            updated[index] = { ...updated[index], description: value };
            return updated;
        });
    }

    async onImageSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (file) {
            this.error.set(null); // Clear previous errors

            // Prevent multiple simultaneous uploads
            if (this.uploadingImage()) {
                return;
            }

            this.imageFile.set(file);

            // Upload immediately - don't wait for save
            this.uploadingImage.set(true);
            const { url, error: uploadError } = await this.supabase.uploadRecipeImage(file);
            this.uploadingImage.set(false);

            if (uploadError) {
                this.error.set('Afbeelding uploaden mislukt: ' + uploadError.message);
                this.imageFile.set(null);
                // Reset the file input element
                (event.target as HTMLInputElement).value = '';
                return;
            }

            if (url) {
                this.imageUrl.set(url);
                this.imagePreview.set(url);
                this.imageFile.set(null); // Clear file reference after upload
            }
        }
    }

    removeImage() {
        this.imageFile.set(null);
        this.imagePreview.set(null);
        this.imageUrl.set('');
    }

    async parseIngredients() {
        const text = this.rawIngredientsText().trim();
        if (!text) {
            return;
        }

        this.ingredientsParser.stop();
        this.error.set(null);
        this.ingredients.set([]);
        await this.ingredientsParser.submit({ text, type: 'ingredients' });

        if (!this.ingredientsParser.object?.items && !this.error()) {
            this.error.set('Parsen mislukt: ongeldige response');
        }
    }

    async parseSteps() {
        const text = this.rawStepsText().trim();
        if (!text) {
            return;
        }

        this.stepsParser.stop();
        this.error.set(null);
        this.steps.set([]);
        await this.stepsParser.submit({ text, type: 'steps' });

        if (!this.stepsParser.object?.items && !this.error()) {
            this.error.set('Parsen mislukt: ongeldige response');
        }
    }

    private toIngredientForm(ingredient: Partial<ParsedIngredientResult> | undefined): IngredientForm {
        return {
            name: ingredient?.name ?? '',
            amount: typeof ingredient?.amount === 'number' ? ingredient.amount : null,
            unit: ingredient?.unit ?? '',
            ...(typeof ingredient?.note === 'string' ? { note: ingredient.note } : {}),
            section_name: ingredient?.section_name ?? null,
        };
    }

    private toStepForm(step: Partial<ParsedStepResult> | undefined): StepForm {
        return {
            description: step?.description ?? '',
            section_name: step?.section_name ?? null,
        };
    }

    private formatParserError(error: Error | undefined): string {
        const message = this.extractParserErrorMessage(error);
        return `Parsen mislukt: ${message ?? 'ongeldige response'}`;
    }

    private extractParserErrorMessage(error: Error | undefined): string | null {
        const message = error?.message?.trim();

        if (!message) {
            return null;
        }

        try {
            const parsed = JSON.parse(message) as { error?: unknown };

            return typeof parsed.error === 'string' && parsed.error.trim().length > 0 ? parsed.error.trim() : message;
        } catch {
            return message;
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

        // Image already uploaded, just use the URL
        const recipeData = {
            title: this.title(),
            description: this.description() || undefined,
            category_id: this.categoryId() || undefined,
            image_url: this.imageUrl() || undefined,
            prep_time: this.prepTime() ?? undefined,
            cook_time: this.cookTime() ?? undefined,
            servings: this.servings() ?? undefined,
            is_published: true,
        };

        const ingredientsData = validIngredients.map((i, idx) => ({
            name: i.name,
            amount: i.amount ?? undefined,
            unit: i.unit || undefined,
            sort_order: idx,
            section_name: i.section_name || undefined,
            note: (i.note ?? '').trim() || undefined,
        }));

        const stepsData = validSteps.map((s, idx) => ({
            step_number: idx + 1,
            description: s.description,
            section_name: s.section_name || undefined,
        }));

        // Call create or update based on mode
        const { data, error } = this.isEditMode()
            ? await this.supabase.updateRecipe(this.recipeId()!, recipeData, ingredientsData, stepsData)
            : await this.supabase.createRecipe(recipeData, ingredientsData, stepsData);

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
