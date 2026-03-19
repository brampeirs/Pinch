import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createGateway, embed, generateText, Output } from 'npm:ai';
import { z } from 'npm:zod';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const aiGatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY');
if (!aiGatewayApiKey) {
    throw new Error('AI_GATEWAY_API_KEY is not set');
}

const aiGateway = createGateway({ apiKey: aiGatewayApiKey });

interface EmbedRequest {
    recipe_id: string;
}

interface Ingredient {
    name: string;
    amount: number | null;
    unit: string | null;
    sort_order: number;
    section_name?: string | null;
}

interface RecipeStep {
    step_number: number;
    description: string;
    section_name?: string | null;
}

interface Recipe {
    id: string;
    title: string;
    description: string | null;
    category: { name: string } | null;
    ingredients: Ingredient[];
    recipe_steps: RecipeStep[];
}

interface RecipeRow {
    id: string;
    title: string;
    description: string | null;
    category: { name: string } | { name: string }[] | null;
    ingredients: Ingredient[];
    recipe_steps: RecipeStep[];
}

const enrichmentSchema = z.object({
    cuisine: z.string().nullable(),
    tags: z.array(z.string()),
    dietary: z.array(z.string()),
    techniques: z.array(z.string()),
    searchHints: z.array(z.string()),
    summary: z.string().nullable(),
});

type SemanticEnrichment = z.infer<typeof enrichmentSchema>;

const EMPTY_ENRICHMENT: SemanticEnrichment = {
    cuisine: null,
    tags: [],
    dietary: [],
    techniques: [],
    searchHints: [],
    summary: null,
};

const ENRICHMENT_PROMPT = `You create semantic retrieval metadata for recipe search.

The recipe text is factual source material. Infer useful lookup metadata, but do not invent ingredients, techniques, or dietary claims that are not reasonably supported by the recipe.

Rules:
- Recipes are currently written in English.
- Use short lowercase English phrases.
- cuisine: probable cuisine family, or null if unclear.
- tags: 4-8 broad retrieval tags (dish type, cuisine, meal type, flavor profile).
- dietary: only confident dietary labels such as vegetarian, vegan, gluten-free, dairy-free, high-protein.
- techniques: cooking methods/styles explicitly present or strongly implied.
- searchHints: 3-8 alternate phrases a user might search for.
- summary: one short sentence optimized for retrieval, not marketing.
- Never mention section names or formatting artifacts.
- Return only the structured object.`;

function normalizeList(values: string[], maxItems: number): string[] {
    return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].slice(0, maxItems);
}

function normalizeEnrichment(enrichment: SemanticEnrichment | undefined): SemanticEnrichment {
    if (!enrichment) return EMPTY_ENRICHMENT;

    const cuisine = enrichment.cuisine?.trim().toLowerCase() || null;
    const summary = enrichment.summary?.trim() || null;

    return {
        cuisine,
        tags: normalizeList(enrichment.tags, 8),
        dietary: normalizeList(enrichment.dietary, 6),
        techniques: normalizeList(enrichment.techniques, 6),
        searchHints: normalizeList(enrichment.searchHints, 8),
        summary,
    };
}

async function generateSemanticEnrichment(baseText: string): Promise<SemanticEnrichment> {
    try {
        const { output } = await generateText({
            model: aiGateway.languageModel('openai/gpt-4o-mini'),
            output: Output.object({ schema: enrichmentSchema }),
            messages: [
                { role: 'system', content: ENRICHMENT_PROMPT },
                { role: 'user', content: baseText },
            ],
            temperature: 0,
        });

        return normalizeEnrichment(output);
    } catch (error) {
        console.warn('Failed to generate semantic enrichment:', error);
        return EMPTY_ENRICHMENT;
    }
}

function buildBaseRecipeText(recipe: Recipe): string {
    const parts: string[] = [];

    parts.push(`Title: ${recipe.title}`);

    if (recipe.category?.name) {
        parts.push(`Category: ${recipe.category.name}`);
    }

    if (recipe.description) {
        parts.push(`Description: ${recipe.description}`);
    }

    if (recipe.ingredients.length > 0) {
        const sortedIngredients = [...recipe.ingredients].sort((a, b) => a.sort_order - b.sort_order);
        const ingredientLines = sortedIngredients.map((ing) => {
            const amount = ing.amount ? `${ing.amount}` : '';
            const unit = ing.unit || '';
            const prefix = amount || unit ? `${amount}${unit ? ' ' + unit : ''} ` : '';
            const section = ing.section_name ? `[${ing.section_name}] ` : '';
            return `- ${section}${prefix}${ing.name}`;
        });
        parts.push(`\nIngredients:\n${ingredientLines.join('\n')}`);
    }

    if (recipe.recipe_steps.length > 0) {
        const sortedSteps = [...recipe.recipe_steps].sort((a, b) => a.step_number - b.step_number);
        const stepLines = sortedSteps.map((step) => {
            const section = step.section_name ? `[${step.section_name}] ` : '';
            return `${step.step_number}. ${section}${step.description}`;
        });
        parts.push(`\nPreparation:\n${stepLines.join('\n')}`);
    }

    return parts.join('\n');
}

function buildEmbeddingInput(baseText: string, enrichment: SemanticEnrichment): string {
    const parts = [baseText];
    const semanticParts: string[] = [];

    if (enrichment.cuisine) {
        semanticParts.push(`Cuisine: ${enrichment.cuisine}`);
    }

    if (enrichment.tags.length > 0) {
        semanticParts.push(`Tags: ${enrichment.tags.join(', ')}`);
    }

    if (enrichment.dietary.length > 0) {
        semanticParts.push(`Dietary: ${enrichment.dietary.join(', ')}`);
    }

    if (enrichment.techniques.length > 0) {
        semanticParts.push(`Techniques: ${enrichment.techniques.join(', ')}`);
    }

    if (enrichment.searchHints.length > 0) {
        semanticParts.push(`Search hints: ${enrichment.searchHints.join(' | ')}`);
    }

    if (enrichment.summary) {
        semanticParts.push(`Semantic summary: ${enrichment.summary}`);
    }

    if (semanticParts.length > 0) {
        parts.push(`\nSemantic retrieval metadata:\n${semanticParts.join('\n')}`);
    }

    return parts.join('\n');
}

function normalizeRecipe(row: RecipeRow): Recipe {
    return {
        ...row,
        category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
    };
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing environment variables');
        }

        const { recipe_id }: EmbedRequest = await req.json();

        if (!recipe_id) {
            throw new Error('Missing recipe_id parameter');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: recipe, error: fetchError } = await supabase
            .from('recipes')
            .select(
                `
        id,
        title,
        description,
        category:categories(name),
        ingredients(*),
        recipe_steps(*)
      `,
            )
            .eq('id', recipe_id)
            .single();

        if (fetchError || !recipe) {
            throw new Error(`Recipe not found: ${fetchError?.message || 'Unknown error'}`);
        }

        const typedRecipe = normalizeRecipe(recipe as unknown as RecipeRow);
        const baseText = buildBaseRecipeText(typedRecipe);
        const enrichment = await generateSemanticEnrichment(baseText);
        const content = buildEmbeddingInput(baseText, enrichment);

        console.log('🧠 Semantic enrichment:', JSON.stringify(enrichment));

        const { embedding, usage } = await embed({
            model: aiGateway.embeddingModel('openai/text-embedding-3-small'),
            value: content,
        });
        const tokens = usage.tokens;

        const embeddingString = `[${embedding.join(',')}]`;

        const { error: upsertError } = await supabase.from('recipe_embeddings').upsert(
            {
                recipe_id,
                content,
                embedding: embeddingString,
                model: 'text-embedding-3-small',
                tokens,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'recipe_id' },
        );

        if (upsertError) {
            throw new Error(`Failed to save embedding: ${upsertError.message}`);
        }

        return new Response(JSON.stringify({ success: true, recipe_id, tokens }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
