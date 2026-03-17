import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { ToolLoopAgent, stepCountIs, createAgentUIStreamResponse } from 'npm:ai';
import { createOpenAI } from 'npm:@ai-sdk/openai';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createFindRecipeTool } from './tools/find-recipe.ts';
import { createCreateRecipeTool } from './tools/create-recipe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize providers
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const openai = createOpenAI({ apiKey: openaiApiKey });

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize tools
const findRecipeTool = createFindRecipeTool(supabase);
const createRecipeTool = createCreateRecipeTool(supabase);

// Create the ToolLoopAgent with reasoning enabled (using responses API)
const recipeAgent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'),
  tools: {
    findRecipe: findRecipeTool,
    createRecipe: createRecipeTool,
  },
  // providerOptions: {
  //   openai: {
  //     reasoningSummary: 'detailed',
  //     reasoningEffort: 'medium',
  //   },
  // },
  instructions: `You are a friendly cooking assistant for a recipe app called Pinch.

**FINDING RECIPES - CRITICAL RULES:**
When a user asks for recipes or mentions ingredients:
1. Call findRecipe with optimized search terms
2. STOP IMMEDIATELY after the tool call - DO NOT generate ANY text
3. The UI automatically renders beautiful recipe cards from the tool result
4. ANY text you generate will appear AFTER the cards and look broken/ugly
5. Your response after findRecipe must be COMPLETELY EMPTY - zero characters

**CREATING RECIPES:**
When a user wants to save/create/add a recipe:
- Extract title, ingredients (with amounts/units), and steps from their message
- Call createRecipe with the structured data
- After success, briefly confirm the recipe was saved

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
`,
  stopWhen: stepCountIs(15),
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const response = await createAgentUIStreamResponse({
      agent: recipeAgent,
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
