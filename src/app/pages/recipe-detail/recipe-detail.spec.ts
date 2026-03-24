import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { ChatContextService } from '../../services/chat-context.service';
import { RecipeDetailPage } from './recipe-detail';

describe('RecipeDetailPage - Step Numbering', () => {
    let fixture: ComponentFixture<RecipeDetailPage>;
    const supabaseService = {
        getRecipeById: vi.fn(),
        deleteRecipe: vi.fn(),
    };
    const chatContextService = {
        setRecipeContext: vi.fn(),
        clearRecipeContext: vi.fn(),
    };

    beforeEach(async () => {
        supabaseService.getRecipeById.mockReset();
        supabaseService.deleteRecipe.mockReset();
        chatContextService.setRecipeContext.mockReset();
        chatContextService.clearRecipeContext.mockReset();

        await TestBed.configureTestingModule({
            imports: [RecipeDetailPage],
            providers: [
                provideRouter([]),
                { provide: SupabaseService, useValue: supabaseService },
                { provide: ChatContextService, useValue: chatContextService },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        paramMap: of(convertToParamMap({ id: 'test-recipe-id' })),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RecipeDetailPage);
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('renders section-local step numbering (1, 2, 3 per section)', async () => {
        const mockRecipe = {
            id: 'test-recipe-id',
            title: 'Test Recipe',
            description: 'A test recipe',
            image_url: '',
            prep_time: 10,
            cook_time: 20,
            servings: 2,
            category_id: null,
            user_id: null,
            created_at: '2026-03-24T00:00:00.000Z',
            updated_at: '2026-03-24T00:00:00.000Z',
            is_published: true,
            category: { id: 'cat-1', name: 'Pasta', slug: 'pasta', emoji: '🍝', description: null, created_at: '' },
            ingredients: [],
            recipe_steps: [
                { id: '1', recipe_id: 'test-recipe-id', step_number: 1, description: 'Step 1 Main', section_name: null, created_at: '' },
                { id: '2', recipe_id: 'test-recipe-id', step_number: 2, description: 'Step 2 Main', section_name: null, created_at: '' },
                { id: '3', recipe_id: 'test-recipe-id', step_number: 3, description: 'Step 3 Main', section_name: null, created_at: '' },
                { id: '4', recipe_id: 'test-recipe-id', step_number: 4, description: 'Step 1 Sauce', section_name: 'Sauce', created_at: '' },
                { id: '5', recipe_id: 'test-recipe-id', step_number: 5, description: 'Step 2 Sauce', section_name: 'Sauce', created_at: '' },
            ],
        };

        supabaseService.getRecipeById.mockResolvedValue({ data: mockRecipe, error: null });

        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const stepBadges = fixture.nativeElement.querySelectorAll('span.rounded-full.bg-indigo-600');
        const badgeTexts = Array.from(stepBadges, (el) => (el as HTMLElement).textContent?.trim());

        // First section (no section_name): steps 1, 2, 3
        // Second section (Sauce): steps 1, 2 (restarted)
        expect(badgeTexts).toEqual(['1', '2', '3', '1', '2']);
    });

    it('renders section headers correctly', async () => {
        const mockRecipe = {
            id: 'test-recipe-id',
            title: 'Test Recipe',
            description: 'A test recipe',
            image_url: '',
            prep_time: 10,
            cook_time: 20,
            servings: 2,
            category_id: null,
            user_id: null,
            created_at: '2026-03-24T00:00:00.000Z',
            updated_at: '2026-03-24T00:00:00.000Z',
            is_published: true,
            category: { id: 'cat-1', name: 'Pasta', slug: 'pasta', emoji: '🍝', description: null, created_at: '' },
            ingredients: [],
            recipe_steps: [
                { id: '1', recipe_id: 'test-recipe-id', step_number: 1, description: 'Main step', section_name: null, created_at: '' },
                { id: '2', recipe_id: 'test-recipe-id', step_number: 2, description: 'Sauce step', section_name: 'Sauce', created_at: '' },
            ],
        };

        supabaseService.getRecipeById.mockResolvedValue({ data: mockRecipe, error: null });

        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('Sauce');
    });
});

