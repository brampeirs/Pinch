import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AddRecipePage } from './add-recipe';
import { SupabaseService } from '../../services/supabase.service';

async function* createStream<T>(chunks: T[]) {
    for (const chunk of chunks) {
        yield chunk;
    }
}

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
        supabaseService.parseRecipeTextStream.mockReset();

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

    it('streams parsed ingredients as structured partial objects', async () => {
        const component = fixture.componentInstance;
        const parsedIngredients = [
            { name: 'flour', amount: 500, unit: 'g', section_name: 'Dough' },
            { name: 'water', amount: 300, unit: 'ml', section_name: 'Dough' },
        ];

        component.rawIngredientsText.set('500g flour\n300ml water');
        supabaseService.parseRecipeTextStream.mockReturnValue(
            createStream([
                { partial: { items: [parsedIngredients[0]] } },
                { partial: { items: parsedIngredients }, done: true },
            ]),
        );

        await component.parseIngredients();

        expect(supabaseService.parseRecipeTextStream).toHaveBeenCalledWith('500g flour\n300ml water', 'ingredients');
        expect(component.ingredients()).toEqual(parsedIngredients);
        expect(component.rawIngredientsText()).toBe('');
        expect(component.error()).toBeNull();
        expect(component.parsingIngredients()).toBe(false);
    });

    it('streams parsed steps as structured partial objects', async () => {
        const component = fixture.componentInstance;
        const parsedSteps = [
            { description: 'Mix everything together.', section_name: 'Dough' },
            { description: 'Bake until golden.', section_name: null },
        ];

        component.rawStepsText.set('Mix everything together. Bake until golden.');
        supabaseService.parseRecipeTextStream.mockReturnValue(
            createStream([{ partial: { items: parsedSteps } }, { done: true }]),
        );

        await component.parseSteps();

        expect(supabaseService.parseRecipeTextStream).toHaveBeenCalledWith(
            'Mix everything together. Bake until golden.',
            'steps',
        );
        expect(component.steps()).toEqual(parsedSteps);
        expect(component.rawStepsText()).toBe('');
        expect(component.error()).toBeNull();
        expect(component.parsingSteps()).toBe(false);
    });

    it('shows a parse error when the stream reports one', async () => {
        const component = fixture.componentInstance;

        component.rawIngredientsText.set('broken ingredient text');
        supabaseService.parseRecipeTextStream.mockReturnValue(createStream([{ error: 'bad response' }]));

        await component.parseIngredients();

        expect(component.error()).toBe('Parsen mislukt: bad response');
        expect(component.parsingIngredients()).toBe(false);
    });
});
