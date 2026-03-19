import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Recipe, RecipeCard, RecipeWithCategory, mapRecipeToUI } from '../../components/recipe-card/recipe-card';
import { Tables } from '../../models/database.types';
import { SupabaseService } from '../../services/supabase.service';
import { map } from 'rxjs';

type Category = Tables<'categories'>;

@Component({
    selector: 'app-recipes',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, RecipeCard],
    templateUrl: './recipes.html',
    styleUrl: './recipes.scss',
})
export class RecipesPage implements OnInit {
    private readonly supabase = inject(SupabaseService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);

    readonly activeFilterClasses =
        'inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300';
    readonly inactiveFilterClasses =
        'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300';

    recipes = signal<Recipe[]>([]);
    categories = signal<Category[]>([]);
    selectedCategory = signal<string | null>(null);
    loading = signal(true);
    error = signal<string | null>(null);
    searchQuery = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('q')?.trim() ?? '')), {
        initialValue: '',
    });
    availableCategories = computed(() => {
        const recipeCategories = new Set(
            this.recipes()
                .map((recipe) => recipe.category)
                .filter(Boolean),
        );
        return this.categories().filter((category) => recipeCategories.has(category.name));
    });
    searchedRecipes = computed(() => {
        const searchQuery = this.searchQuery().toLowerCase();

        if (!searchQuery) {
            return this.recipes();
        }

        return this.recipes().filter((recipe) => {
            const searchableText = [recipe.title, recipe.description, recipe.category].join(' ').toLowerCase();
            return searchableText.includes(searchQuery);
        });
    });
    filteredRecipes = computed(() => {
        const selectedCategory = this.selectedCategory();
        const recipes = this.searchedRecipes();

        if (!selectedCategory) {
            return recipes;
        }

        return recipes.filter((recipe) => recipe.category === selectedCategory);
    });
    emptyStateMessage = computed(() => {
        const searchQuery = this.searchQuery();
        const selectedCategory = this.selectedCategory();

        if (searchQuery && selectedCategory) {
            return `No recipes found for "${searchQuery}" in ${selectedCategory}.`;
        }

        if (searchQuery) {
            return `No recipes found for "${searchQuery}".`;
        }

        if (selectedCategory) {
            return 'No recipes found in this category.';
        }

        return 'No recipes found.';
    });

    async ngOnInit() {
        await this.loadData();
    }

    async reload() {
        await this.loadData();
    }

    selectCategory(categoryName: string | null) {
        this.selectedCategory.set(categoryName);
    }

    clearSearch() {
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { q: null },
            queryParamsHandling: 'merge',
        });
    }

    private async loadData() {
        this.loading.set(true);
        this.error.set(null);

        try {
            const [recipesResult, categoriesResult] = await Promise.all([
                this.supabase.getRecipes(),
                this.supabase.getCategories(),
            ]);

            if (recipesResult.error) throw recipesResult.error;
            if (categoriesResult.error) throw categoriesResult.error;

            const mappedRecipes = (recipesResult.data as RecipeWithCategory[]).map(mapRecipeToUI);
            this.recipes.set(mappedRecipes);

            const categories = (categoriesResult.data as Category[] | null) ?? [];
            this.categories.set(categories);

            const selectedCategory = this.selectedCategory();
            const categoryStillExists = selectedCategory
                ? mappedRecipes.some((recipe) => recipe.category === selectedCategory)
                : true;

            if (!categoryStillExists) {
                this.selectedCategory.set(null);
            }
        } catch (err) {
            console.error('Error loading recipes:', err);
            this.error.set('Something went wrong while loading recipes.');
        } finally {
            this.loading.set(false);
        }
    }
}
