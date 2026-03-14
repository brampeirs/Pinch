import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { ToolLoopAgent, stepCountIs, createAgentUIStreamResponse } from 'npm:ai';
import { createOpenAI } from 'npm:@ai-sdk/openai';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createFindRecipeTool } from './tools/find-recipe.ts';
import { optimizeRecipeQueryTool } from './tools/optimize-recipe-query.ts';

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

// Create the ToolLoopAgent - no reasoning to keep responses fast
const recipeAgent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'),
  tools: {
    optimizeRecipeQuery: optimizeRecipeQueryTool,
    findRecipe: findRecipeTool,
  },
  instructions: `You are a friendly cooking assistant for a recipe app called Pinch.

**CRITICAL WORKFLOW - MUST FOLLOW:**
When a user asks for recipes or mentions ingredients:
1. FIRST: Call optimizeRecipeQuery with the user's query
2. SECOND: Call findRecipe with the optimized query from step 1
3. NEVER skip step 1 - always optimize before searching

**RECIPE RESULTS - EXTREMELY IMPORTANT:**
After showing recipe results, DO NOT write any text response.
The recipe cards are automatically displayed by the UI - they speak for themselves.
Your job is done after calling findRecipe. Say NOTHING after the tool calls.
No "here are the recipes", no descriptions, no follow-up questions. Just silence.

**Other capabilities:**
- Answer cooking questions (be helpful but concise)
- Provide cooking tips and advice

**Response style:**
- Be warm but extremely concise
- Maximum 1-2 short sentences when NOT showing recipes
- When showing recipes: say NOTHING, let the cards do the talking
- Only when no recipes are found: respond.

Available categories: Pasta, Soups, Salads, Main Dishes, Desserts, Breakfast
Common tags: quick, vegetarian, vegan, spicy, comfort food, healthy
`,
  stopWhen: stepCountIs(5),
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
        sendReasoning: false,
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
