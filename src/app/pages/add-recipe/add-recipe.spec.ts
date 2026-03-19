import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AddRecipePage } from './add-recipe';
import { SupabaseService } from '../../services/supabase.service';

describe('AddRecipePage', () => {
    let fixture: ComponentFixture<AddRecipePage>;
    const supabaseService = {
        getCategories: vi.fn(),
        getRecipeById: vi.fn(),
        updateRecipe: vi.fn(),
        createRecipe: vi.fn(),
        uploadRecipeImage: vi.fn(),
        parseRecipeTextStream: vi.fn(),
    };

    beforeEach(async () => {
        supabaseService.getCategories.mockResolvedValue({ data: [], error: null });

        await TestBed.configureTestingModule({
            imports: [AddRecipePage],
            providers: [provideRouter([]), { provide: SupabaseService, useValue: supabaseService }],
        }).compileComponents();

        fixture = TestBed.createComponent(AddRecipePage);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    it('uses the write or paste copy for the manual recipe path', () => {
        const element = fixture.nativeElement as HTMLElement;
        const text = element.textContent ?? '';
        const heroTitleInput = element.querySelector<HTMLInputElement>('#recipe-title-hero');
        const heroCategorySelect = element.querySelector<HTMLSelectElement>('#recipe-category');
        const heroDescription = element.querySelector<HTMLTextAreaElement>('#recipe-description');
        const heroPrepTime = element.querySelector<HTMLInputElement>('#recipe-prep-time');
        const heroCookTime = element.querySelector<HTMLInputElement>('#recipe-cook-time');
        const heroServings = element.querySelector<HTMLInputElement>('#recipe-servings');

        expect(text).toContain('Upload cover image');
        expect(heroTitleInput?.getAttribute('placeholder')).toBe('Your recipe title');
        expect(heroCategorySelect).not.toBeNull();
        expect(heroDescription?.getAttribute('placeholder')).toBe('Short description of the recipe...');
        expect(heroPrepTime?.getAttribute('placeholder')).toBe('15');
        expect(heroCookTime?.getAttribute('placeholder')).toBe('30');
        expect(heroServings?.getAttribute('placeholder')).toBe('4');
        expect(text).not.toContain('Recipe details');
        expect(text).toContain('Ingredients paste');
        expect(text).toContain('Instructions paste');
        expect(text).toContain('Ingredients *');
        expect(text).toContain('Instructions *');
        expect(element.querySelector('a[href="/recipes/new"]')?.textContent).toContain('Back to options');
    });
});
