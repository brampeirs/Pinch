import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { ToolLoopAgent, stepCountIs, createAgentUIStreamResponse, createGateway } from 'npm:ai';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createFindRecipeTool } from './tools/find-recipe.ts';
import { createCreateRecipeTool } from './tools/create-recipe.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AGENT_INSTRUCTIONS = `You are a friendly cooking assistant for a recipe app called Pinch.

**FINDING RECIPES - CRITICAL RULES:**
When a user asks for recipes or mentions ingredients:
1. Call findRecipe with optimized search terms
2. STOP IMMEDIATELY after the tool call - DO NOT generate ANY text
3. The UI automatically renders beautiful recipe cards from the tool result
4. ANY text you generate will appear AFTER the cards and look broken/ugly
5. Your response after findRecipe must be COMPLETELY EMPTY - zero characters

**CREATING RECIPES - CRITICAL RULES:**
When a user wants to save/create/add a recipe:
1. Extract title, ingredients (with amounts/units), and steps from their message
2. Call createRecipe with the structured data
3. STOP IMMEDIATELY after the tool call - DO NOT generate ANY text
4. The UI automatically renders the created recipe as a beautiful card
5. Your response after createRecipe must be COMPLETELY EMPTY - zero characters

**Other capabilities:**
- Answer cooking questions (be helpful but concise)
- Provide cooking tips and advice

**Response style:**
- Use short paragraphs
- Use bullet lists for multiple items
- Use numbered lists for steps
- Use **bold** for key terms
- Avoid long text blocks

Available categories: Pasta, Soups, Salads, Main Dishes, Desserts, Breakfast
Common tags: quick, vegetarian, vegan, spicy, comfort food, healthy
`;

// Lazy initialization - only created on first POST request
let recipeAgent: ToolLoopAgent | null = null;

function getRecipeAgent(): ToolLoopAgent {
    if (recipeAgent) return recipeAgent;

    // Initialize AI Gateway
    const aiGatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!aiGatewayApiKey) {
        throw new Error('AI_GATEWAY_API_KEY is not set');
    }
    const aiGateway = createGateway({ apiKey: aiGatewayApiKey });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize tools
    const findRecipeTool = createFindRecipeTool(supabase);
    const createRecipeTool = createCreateRecipeTool(supabase);

    // Create the ToolLoopAgent
    recipeAgent = new ToolLoopAgent({
        model: aiGateway.languageModel('openai/gpt-4o-mini'),
        tools: {
            findRecipe: findRecipeTool,
            createRecipe: createRecipeTool,
        },
        instructions: AGENT_INSTRUCTIONS,
        stopWhen: stepCountIs(15),
    });

    return recipeAgent;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight FIRST - before any initialization
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { messages } = await req.json();
        const agent = getRecipeAgent();

        const response = await createAgentUIStreamResponse({
            agent,
            uiMessages: messages,
            streamOptions: {
                sendReasoning: true,
            },
        });

        // Add CORS headers to the streaming response
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
            headers.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Chat error:', message);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
