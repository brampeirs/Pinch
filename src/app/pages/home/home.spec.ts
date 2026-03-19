import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Home } from './home';
import { SupabaseService } from '../../services/supabase.service';
import { RecipeWithCategory } from '../../components/recipe-card/recipe-card';

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
            name: 'Soups',
            slug: 'soups',
            emoji: '🥣',
            description: null,
            created_at: '2026-03-19T00:00:00.000Z',
        },
    }));
}

describe('Home', () => {
    let fixture: ComponentFixture<Home>;
    const supabaseService = {
        getRecipes: vi.fn(),
        getCategories: vi.fn(),
    };

    beforeEach(async () => {
        supabaseService.getRecipes.mockResolvedValue({ data: createRecipeRows(6), error: null });
        supabaseService.getCategories.mockResolvedValue({ data: [], error: null });

        await TestBed.configureTestingModule({
            imports: [Home],
            providers: [provideRouter([]), { provide: SupabaseService, useValue: supabaseService }],
        }).compileComponents();

        fixture = TestBed.createComponent(Home);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    it('centers the latest recipes heading and renders only four recipe cards', () => {
        const heading = (Array.from(fixture.nativeElement.querySelectorAll('h2')) as HTMLHeadingElement[]).find(
            (element) => element.textContent?.includes('Latest recipes'),
        );
        const headingBlock = heading?.parentElement;

        expect(headingBlock?.className).toContain('text-center');
        expect(fixture.nativeElement.querySelectorAll('app-recipe-card').length).toBe(4);

        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('Latest recipes');
        expect(text).toContain('Fresh from the kitchen');
        expect(text).toContain('All recipes >');
        expect(text).toContain('Recipe 4');
        expect(text).not.toContain('Recipe 5');
    });
});
