import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { RecipeWithCategory } from '../../components/recipe-card/recipe-card';
import { SupabaseService } from '../../services/supabase.service';
import { RecipesPage } from './recipes';

function createRecipeRows(count: number): RecipeWithCategory[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `recipe-${index + 1}`,
        title: `Recipe ${index + 1}`,
        description: `Description ${index + 1}`,
        image_url: '',
        category_id: null,
        prep_time: 10,
        cook_time: 20,
        servings: 4,
        user_id: null,
        created_at: '2026-03-19T00:00:00.000Z',
        updated_at: '2026-03-19T00:00:00.000Z',
        is_published: true,
        category: {
            id: `category-${index + 1}`,
            name: 'Pasta',
            slug: 'pasta',
            emoji: '🍝',
            description: null,
            created_at: '2026-03-19T00:00:00.000Z',
        },
    }));
}

describe('RecipesPage', () => {
    let fixture: ComponentFixture<RecipesPage>;
    const supabaseService = {
        getRecipes: vi.fn(),
    };

    beforeEach(async () => {
        supabaseService.getRecipes.mockResolvedValue({ data: createRecipeRows(6), error: null });

        await TestBed.configureTestingModule({
            imports: [RecipesPage],
            providers: [provideRouter([]), { provide: SupabaseService, useValue: supabaseService }],
        }).compileComponents();

        fixture = TestBed.createComponent(RecipesPage);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    it('renders all available recipe cards on the recipes page', () => {
        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('All recipes');
        expect(fixture.nativeElement.querySelectorAll('app-recipe-card').length).toBe(6);
        expect(text).toContain('Recipe 6');
    });
});
