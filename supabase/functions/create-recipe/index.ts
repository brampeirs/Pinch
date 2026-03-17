import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateRecipeRequest {
  recipe: {
    title: string;
    description?: string;
    category_id?: string;
    image_url?: string;
    prep_time?: number;
    cook_time?: number;
    servings?: number;
    is_published?: boolean;
  };
  ingredients: Array<{
    name: string;
    amount?: number;
    unit?: string;
    sort_order?: number;
  }>;
  steps: Array<{
    step_number: number;
    description: string;
  }>;
}

interface CreateRecipeResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    category_name: string | null;
    prep_time: number | null;
    cook_time: number | null;
    servings: number | null;
    created_at: string;
  };
  error?: string;
  details?: {
    field: string;
    message: string;
  };
}

/**
 * Validate request payload
 */
function validateRequest(req: CreateRecipeRequest): { valid: boolean; error?: string; field?: string } {
  // Validate recipe.title
  if (!req.recipe.title || req.recipe.title.trim().length === 0) {
    return { valid: false, error: 'Title is required', field: 'recipe.title' };
  }
  if (req.recipe.title.length > 500) {
    return { valid: false, error: 'Title must be less than 500 characters', field: 'recipe.title' };
  }

  // Validate description length
  if (req.recipe.description && req.recipe.description.length > 2000) {
    return { valid: false, error: 'Description must be less than 2000 characters', field: 'recipe.description' };
  }

  // Validate ingredients
  if (!req.ingredients || req.ingredients.length === 0) {
    return { valid: false, error: 'At least one ingredient is required', field: 'ingredients' };
  }
  for (const ing of req.ingredients) {
    if (!ing.name || ing.name.trim().length === 0) {
      return { valid: false, error: 'Ingredient name is required', field: 'ingredients.name' };
    }
  }

  // Validate steps
  if (!req.steps || req.steps.length === 0) {
    return { valid: false, error: 'At least one step is required', field: 'steps' };
  }
  for (const step of req.steps) {
    if (!step.description || step.description.trim().length === 0) {
      return { valid: false, error: 'Step description is required', field: 'steps.description' };
    }
  }

  // Validate numeric fields if provided
  if (req.recipe.prep_time !== undefined && req.recipe.prep_time < 0) {
    return { valid: false, error: 'Prep time must be positive', field: 'recipe.prep_time' };
  }
  if (req.recipe.cook_time !== undefined && req.recipe.cook_time < 0) {
    return { valid: false, error: 'Cook time must be positive', field: 'recipe.cook_time' };
  }
  if (req.recipe.servings !== undefined && req.recipe.servings < 1) {
    return { valid: false, error: 'Servings must be at least 1', field: 'recipe.servings' };
  }

  return { valid: true };
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

    // Parse request body
    const body: CreateRecipeRequest = await req.json();

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      const response: CreateRecipeResponse = {
        success: false,
        error: validation.error,
        details: validation.field ? { field: validation.field, message: validation.error! } : undefined,
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_recipe', {
      recipe_data: body.recipe,
      ingredients_data: body.ingredients,
      steps_data: body.steps,
    });

    if (rpcError) {
      throw new Error(`RPC error: ${rpcError.message}`);
    }

    // Fire-and-forget: trigger embedding generation
    const recipeId = rpcData.id;
    supabase.functions
      .invoke('embed-recipe', { body: { recipe_id: recipeId } })
      .catch((err) => {
        console.warn('Failed to trigger embedding:', err);
      });

    // Return success response
    const response: CreateRecipeResponse = {
      success: true,
      data: rpcData,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const response: CreateRecipeResponse = {
      success: false,
      error: message,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
