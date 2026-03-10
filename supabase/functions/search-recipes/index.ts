import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import OpenAI from 'jsr:@openai/openai';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SearchRequest {
  query?: string;
  messages?: ChatMessage[];
  match_count?: number;
  match_threshold?: number;
}

// JSON Schema for Structured Outputs
const RESPONSE_SCHEMA = {
  name: 'assistant_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['search_recipes', 'answer_question', 'greeting', 'unclear'],
        description: 'The detected intent of the user message',
      },
      search_query: {
        type: ['string', 'null'],
        description: 'Optimized search terms if intent is search_recipes, otherwise null',
      },
      message: {
        type: 'string',
        description: 'A friendly response message to show the user',
      },
    },
    required: ['intent', 'search_query', 'message'],
    additionalProperties: false,
  },
} as const;

const ASSISTANT_PROMPT = `You are a friendly cooking assistant for a recipe app called Pinch.

Your task is to determine what the user wants and provide an appropriate response.

IMPORTANT: You can ONLY suggest recipes that exist in our database. You will search for recipes and results will be shown to the user. Do NOT make up or suggest specific recipe names - just indicate you're searching and let the results speak for themselves.

INTENTS:
- search_recipes: User is looking for recipes (e.g., "do you have pasta?", "something with chicken", "I want to make tacos")
- answer_question: User asks a cooking question without searching for a specific recipe (e.g., "how long should I cook rice?")
- greeting: User greets or starts a conversation (e.g., "hello", "hey")
- unclear: You don't understand what the user means

FOR SEARCH_RECIPES:
- Convert the query into optimized search terms in search_query
- Remove question words, keep keywords (dish, ingredients, cuisine)
- Example: "do you have soup?" → search_query: "soup broth"
- Keep your message SHORT and generic: "Let me search for recipes with [ingredients]!" or "Searching for [dish] recipes..."
- Do NOT suggest specific dishes like "Maybe a gazpacho or fresh salad?" - you don't know what's in the database!
- Do NOT promise results - just say you're looking

FOR OTHER INTENTS:
- search_query must be null
- Provide a helpful response in message`;

Deno.serve(async (req: Request) => {
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

    const {
      query,
      messages = [],
      match_count = 5,
      match_threshold = 0.25,
    }: SearchRequest = await req.json();

    // Support both old (query) and new (messages) format for backwards compatibility
    const conversationMessages: ChatMessage[] =
      messages.length > 0 ? messages : query ? [{ role: 'user' as const, content: query }] : [];

    if (conversationMessages.length === 0) {
      throw new Error('Missing query or messages parameter');
    }

    const openai = new OpenAI({ apiKey: openaiKey });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Analyze intent with Structured Outputs (include conversation history)
    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: ASSISTANT_PROMPT }, ...conversationMessages],
      response_format: {
        type: 'json_schema',
        json_schema: RESPONSE_SCHEMA,
      },
      temperature: 0,
    });

    const analysis = JSON.parse(analysisResponse.choices[0]?.message?.content || '{}');

    // If not a recipe search, return the AI response without searching
    if (analysis.intent !== 'search_recipes' || !analysis.search_query) {
      return new Response(
        JSON.stringify({
          success: true,
          intent: analysis.intent,
          message: analysis.message,
          results: [],
          count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Generate embedding from optimized search query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: analysis.search_query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Step 3: Search with embedding
    const { data: results, error: rpcError } = await supabase.rpc('search_recipes', {
      query_embedding: embedding,
      match_count,
      match_threshold,
    });

    if (rpcError) {
      throw new Error(`RPC error: ${rpcError.message}`);
    }

    // Adjust message if no results found
    const resultCount = results?.length || 0;
    let finalMessage = analysis.message;
    if (resultCount === 0) {
      finalMessage =
        "Sorry, I couldn't find any recipes matching that in our collection. Try different ingredients or a different dish!";
    }

    return new Response(
      JSON.stringify({
        success: true,
        intent: analysis.intent,
        message: finalMessage,
        searchQuery: analysis.search_query,
        results: results || [],
        count: resultCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
