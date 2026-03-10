import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import OpenAI from 'jsr:@openai/openai';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmbedRequest {
  recipe_id: string;
}

interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
  sort_order: number;
}

interface RecipeStep {
  step_number: number;
  description: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  category: { name: string } | null;
  ingredients: Ingredient[];
  recipe_steps: RecipeStep[];
}

/**
 * Build canonical text representation of a recipe for embedding
 */
function buildCanonicalText(recipe: Recipe): string {
  const parts: string[] = [];

  // Title
  parts.push(`Titel: ${recipe.title}`);

  // Category
  if (recipe.category?.name) {
    parts.push(`Categorie: ${recipe.category.name}`);
  }

  // Description
  if (recipe.description) {
    parts.push(`Beschrijving: ${recipe.description}`);
  }

  // Ingredients
  if (recipe.ingredients.length > 0) {
    const sortedIngredients = [...recipe.ingredients].sort((a, b) => a.sort_order - b.sort_order);
    const ingredientLines = sortedIngredients.map((ing) => {
      const amount = ing.amount ? `${ing.amount}` : '';
      const unit = ing.unit || '';
      const prefix = amount || unit ? `${amount}${unit ? ' ' + unit : ''} ` : '';
      return `- ${prefix}${ing.name}`;
    });
    parts.push(`\nIngrediënten:\n${ingredientLines.join('\n')}`);
  }

  // Steps
  if (recipe.recipe_steps.length > 0) {
    const sortedSteps = [...recipe.recipe_steps].sort((a, b) => a.step_number - b.step_number);
    const stepLines = sortedSteps.map((step) => `${step.step_number}. ${step.description}`);
    parts.push(`\nBereiding:\n${stepLines.join('\n')}`);
  }

  return parts.join('\n');
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const { recipe_id }: EmbedRequest = await req.json();

    if (!recipe_id) {
      throw new Error('Missing recipe_id parameter');
    }

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // Fetch recipe with all details
    const { data: recipe, error: fetchError } = await supabase
      .from('recipes')
      .select(`
        id,
        title,
        description,
        category:categories(name),
        ingredients(*),
        recipe_steps(*)
      `)
      .eq('id', recipe_id)
      .single();

    if (fetchError || !recipe) {
      throw new Error(`Recipe not found: ${fetchError?.message || 'Unknown error'}`);
    }

    // Build canonical text
    const content = buildCanonicalText(recipe as Recipe);

    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: content,
    });

    const embedding = embeddingResponse.data[0].embedding;
    const tokens = embeddingResponse.usage.total_tokens;

    // Upsert into recipe_embeddings
    const { error: upsertError } = await supabase
      .from('recipe_embeddings')
      .upsert(
        {
          recipe_id,
          content,
          embedding: JSON.stringify(embedding),
          model: 'text-embedding-3-small',
          tokens,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'recipe_id' }
      );

    if (upsertError) {
      throw new Error(`Failed to save embedding: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, recipe_id, tokens }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

