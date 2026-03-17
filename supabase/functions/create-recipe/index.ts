import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
    createRecipeRequestSchema,
    type CreateRecipeRequest,
    type CreateRecipeResponse,
} from '../_shared/recipe-schemas.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing environment variables');
        }

        // Parse and validate request body with Zod
        let body: CreateRecipeRequest;
        try {
            const json = await req.json();
            body = createRecipeRequestSchema.parse(json);
        } catch (parseError) {
            // Handle JSON parse errors and Zod validation errors
            const errorMessage = parseError instanceof Error ? parseError.message : 'Invalid request body';
            const response: CreateRecipeResponse = {
                success: false,
                error: errorMessage,
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

        if (!rpcData) {
            throw new Error('RPC returned no data');
        }

        // Fire-and-forget: trigger embedding generation
        const recipeId = rpcData.id;
        supabase.functions.invoke('embed-recipe', { body: { recipe_id: recipeId } }).catch((err: Error) => {
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
