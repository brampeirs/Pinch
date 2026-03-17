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

// JSON Schema for Structured Outputs with filters
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
                description:
                    'Optimized search terms for semantic search (ingredients, cooking style, cuisine). Should NOT include category or time constraints.',
            },
            filters: {
                type: 'object',
                properties: {
                    category: {
                        type: ['string', 'null'],
                        description:
                            'Exact category filter. Must be one of: Pasta, Soups, Salads, Main Dishes, Desserts, Breakfast. Use null if not specified.',
                    },
                    tags: {
                        type: ['array', 'null'],
                        items: { type: 'string' },
                        description:
                            'Tags to filter by (e.g., ["quick", "vegetarian", "spicy"]). Use null if not specified.',
                    },
                    max_time: {
                        type: ['integer', 'null'],
                        description:
                            'Maximum total cooking time in minutes (prep + cook). Extract from phrases like "under 30 minutes", "quick", "fast". Use null if not specified.',
                    },
                },
                required: ['category', 'tags', 'max_time'],
                additionalProperties: false,
                description: 'Structured filters for exact matching',
            },
            message: {
                type: 'string',
                description: 'A friendly response message to show the user',
            },
        },
        required: ['intent', 'search_query', 'filters', 'message'],
        additionalProperties: false,
    },
} as const;

const ASSISTANT_PROMPT = `You are a friendly cooking assistant for a recipe app called Pinch.

Your task is to determine what the user wants and provide an appropriate response.

IMPORTANT: You can ONLY suggest recipes that exist in our database. You will search for recipes and results will be shown to the user. Do NOT make up or suggest specific recipe names.

INTENTS:
- search_recipes: User is looking for recipes (e.g., "do you have pasta?", "something with chicken", "desserts under 30 minutes")
- answer_question: User asks a cooking question without searching for a specific recipe
- greeting: User greets or starts a conversation
- unclear: You don't understand what the user means

FOR SEARCH_RECIPES:
1. Extract FILTERS (exact matching):
   - category: Must match exactly: "Pasta", "Soups", "Salads", "Main Dishes", "Desserts", "Breakfast"
   - tags: Keywords like ["quick", "vegetarian", "spicy", "comfort food"]
   - max_time: Convert time phrases ("under 30 minutes" → 30, "quick" → 20)

2. Extract search_query (semantic search):
   - Only include ingredients, cooking style, cuisine, flavors
   - Do NOT include category names or time constraints in search_query
   - Example: "quick Italian desserts" → filters: {category: "Desserts", max_time: 20}, search_query: "Italian sweet"

3. Message: Keep SHORT - "Looking for quick desserts!" or "Searching for Italian dishes..."

EXAMPLES:
- "desserts under 30 minutes" → filters: {category: "Desserts", max_time: 30}, search_query: "sweet treat"
- "something with chicken" → filters: {category: null, max_time: null}, search_query: "chicken"
- "quick vegetarian soup" → filters: {category: "Soups", tags: ["vegetarian"], max_time: 20}, search_query: "vegetarian broth"

FOR OTHER INTENTS:
- search_query and filters must be null
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

        const { query, messages = [], match_count = 5, match_threshold = 0.25 }: SearchRequest = await req.json();

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

        // Log the LLM analysis
        console.log(
            '📝 Search Request:',
            JSON.stringify(
                {
                    userMessage: conversationMessages[conversationMessages.length - 1]?.content,
                    intent: analysis.intent,
                    searchQuery: analysis.search_query,
                    filters: analysis.filters,
                    message: analysis.message,
                },
                null,
                2,
            ),
        );

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
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // Step 2: Generate embedding from optimized search query
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: analysis.search_query,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Step 3: Search with embedding + filters
        const filters = analysis.filters || {};
        const { data: results, error: rpcError } = await supabase.rpc('search_recipes', {
            query_embedding: embedding,
            match_count,
            match_threshold,
            filter_category: filters.category || null,
            filter_tags: filters.tags || null,
            filter_max_time: filters.max_time || null,
        });

        if (rpcError) {
            console.error('❌ RPC Error:', rpcError.message);
            throw new Error(`RPC error: ${rpcError.message}`);
        }

        // Log search results
        const resultCount = results?.length || 0;
        console.log(
            '🔍 Search Results:',
            JSON.stringify(
                {
                    query: analysis.search_query,
                    filters: {
                        category: filters.category || null,
                        tags: filters.tags || null,
                        max_time: filters.max_time || null,
                    },
                    resultCount,
                    results: results?.map((r: { title: string; similarity: number }) => ({
                        title: r.title,
                        similarity: Math.round(r.similarity * 100) + '%',
                    })),
                },
                null,
                2,
            ),
        );

        // Adjust message if no results found
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
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ success: false, error: message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
