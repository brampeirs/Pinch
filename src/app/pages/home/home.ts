import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Recipe, RecipeCard, RecipeWithCategory, mapRecipeToUI } from '../../components/recipe-card/recipe-card';
import { SupabaseService } from '../../services/supabase.service';
import { Tables } from '../../models/database.types';

// Use generated type for categories
type Category = Tables<'categories'>;

@Component({
    selector: 'app-home',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, RecipeCard],
    templateUrl: './home.html',
    styleUrl: './home.scss',
})
export class Home implements OnInit {
    private supabase = inject(SupabaseService);
    private router = inject(Router);

    recipes = signal<Recipe[]>([]);
    categories = signal<Category[]>([]);
    loading = signal(true);
    error = signal<string | null>(null);
    searchQuery = signal('');
    latestRecipes = computed(() => this.recipes().slice(0, 4));

    async ngOnInit() {
        await this.loadData();
    }

    async reload() {
        await this.loadData();
    }

    updateSearchQuery(event: Event) {
        const target = event.target as HTMLInputElement | null;
        this.searchQuery.set(target?.value ?? '');
    }

    submitSearch(event: Event) {
        event.preventDefault();

        const query = this.searchQuery().trim();

        void this.router.navigate(['/recipes'], {
            queryParams: query ? { q: query } : {},
        });
    }

    private async loadData() {
        this.loading.set(true);
        this.error.set(null);

        try {
            // Load recipes and categories in parallel
            const [recipesResult, categoriesResult] = await Promise.all([
                this.supabase.getRecipes(),
                this.supabase.getCategories(),
            ]);

            if (recipesResult.error) throw recipesResult.error;
            if (categoriesResult.error) throw categoriesResult.error;

            // Map database recipes to UI format
            const mappedRecipes = (recipesResult.data as RecipeWithCategory[]).map(mapRecipeToUI);
            this.recipes.set(mappedRecipes);
            this.categories.set(categoriesResult.data || []);
        } catch (err) {
            console.error('Error loading data:', err);
            this.error.set('Something went wrong while loading recipes.');
        } finally {
            this.loading.set(false);
        }
    }
}
