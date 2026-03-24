import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AddRecipePage } from './add-recipe';
import { SupabaseService } from '../../services/supabase.service';

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

function createStructuredObjectStreamResponse(chunks: string[]) {
    const encoder = new TextEncoder();

    return new Response(
        new ReadableStream({
            start(controller) {
                chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
                controller.close();
            },
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        },
    );
}

function createDeferredStructuredObjectStream() {
    const encoder = new TextEncoder();
    const transformStream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = transformStream.writable.getWriter();

    return {
        response: new Response(transformStream.readable, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        }),
        async push(chunk: string) {
            await writer.write(encoder.encode(chunk));
        },
        async close() {
            await writer.close();
        },
    };
}

describe('AddRecipePage', () => {
    let fixture: ComponentFixture<AddRecipePage>;
    const supabaseService = {
        getCategories: vi.fn(),
        getRecipeById: vi.fn(),
        updateRecipe: vi.fn(),
        createRecipe: vi.fn(),
        uploadRecipeImage: vi.fn(),
        parseRecipeStreamFetch: vi.fn(),
    };

    beforeEach(async () => {
        supabaseService.getCategories.mockResolvedValue({ data: [], error: null });
        supabaseService.parseRecipeStreamFetch.mockReset();

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
        const stream = createDeferredStructuredObjectStream();
        const parsedIngredients = [
            { name: 'flour', amount: 500, unit: 'g', section_name: 'Dough' },
            { name: 'water', amount: 300, unit: 'ml', section_name: 'Dough' },
        ];

        component.rawIngredientsText.set('500g flour\n300ml water');
        supabaseService.parseRecipeStreamFetch.mockResolvedValueOnce(stream.response);

        const parsePromise = component.parseIngredients();
        await flushPromises();

        expect(component.parsingIngredients()).toBe(true);
        expect(supabaseService.parseRecipeStreamFetch).toHaveBeenCalledTimes(1);
        expect(supabaseService.parseRecipeStreamFetch.mock.calls[0][0]).toBe('parse-recipe');
        expect(JSON.parse(supabaseService.parseRecipeStreamFetch.mock.calls[0][1].body as string)).toEqual({
            text: '500g flour\n300ml water',
            type: 'ingredients',
        });

        await stream.push(JSON.stringify({ items: parsedIngredients }));
        await flushPromises();
        fixture.detectChanges();

        expect(component.ingredients()).toEqual(parsedIngredients);
        expect(component.rawIngredientsText()).toBe('500g flour\n300ml water');
        expect(component.error()).toBeNull();

        await stream.close();
        await parsePromise;
        await flushPromises();

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
        supabaseService.parseRecipeStreamFetch.mockResolvedValueOnce(
            createStructuredObjectStreamResponse([JSON.stringify({ items: parsedSteps })]),
        );

        await component.parseSteps();

        expect(supabaseService.parseRecipeStreamFetch).toHaveBeenCalledTimes(1);
        expect(supabaseService.parseRecipeStreamFetch.mock.calls[0][0]).toBe('parse-recipe');
        expect(JSON.parse(supabaseService.parseRecipeStreamFetch.mock.calls[0][1].body as string)).toEqual({
            text: 'Mix everything together. Bake until golden.',
            type: 'steps',
        });
        expect(component.steps()).toEqual(parsedSteps);
        expect(component.rawStepsText()).toBe('');
        expect(component.error()).toBeNull();
        expect(component.parsingSteps()).toBe(false);
    });

    it('shows a parse error when the stream reports one', async () => {
        const component = fixture.componentInstance;

        component.rawIngredientsText.set('broken ingredient text');
        supabaseService.parseRecipeStreamFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'bad response' }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }),
        );

        await component.parseIngredients();

        expect(component.error()).toBe('Parsen mislukt: bad response');
        expect(component.parsingIngredients()).toBe(false);
    });

    it('parses plain linear steps without headings as section_name: null', async () => {
        const component = fixture.componentInstance;
        const plainLinearSteps = [
            { description: 'Mix flour and water.', section_name: null },
            { description: 'Knead the dough.', section_name: null },
            { description: 'Let it rise for 1 hour.', section_name: null },
        ];

        component.rawStepsText.set('Mix flour and water. Knead the dough. Let it rise for 1 hour.');
        supabaseService.parseRecipeStreamFetch.mockResolvedValueOnce(
            createStructuredObjectStreamResponse([JSON.stringify({ items: plainLinearSteps })]),
        );

        await component.parseSteps();

        expect(supabaseService.parseRecipeStreamFetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(supabaseService.parseRecipeStreamFetch.mock.calls[0][1].body as string)).toEqual({
            text: 'Mix flour and water. Knead the dough. Let it rise for 1 hour.',
            type: 'steps',
        });
        expect(component.steps()).toEqual(plainLinearSteps);
        // Verify all steps have section_name: null
        expect(component.steps().every((step) => step.section_name === null)).toBe(true);
        expect(component.rawStepsText()).toBe('');
        expect(component.error()).toBeNull();
        expect(component.parsingSteps()).toBe(false);
    });
});
