// Chat function v6 - streamText-based flows (no ToolLoopAgent)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { convertToModelMessages, createGateway } from 'npm:ai';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { routeIntent } from './_lib/route-intent.ts';
import { extractSearchRecipes } from './_lib/extract-search-recipes.ts';
import { isDirectGeneralChat } from './_lib/is-direct-general-chat.ts';
import { runSearchFlow } from './flows/search-flow.ts';
import { runDetailFlow } from './flows/detail-flow.ts';
import { runGeneralChatFlow } from './flows/general-chat-flow.ts';
import { runCreateFlow } from './flows/create-flow.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, accept, origin, referer, user-agent, sec-fetch-dest, sec-fetch-mode, sec-fetch-site',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Access-Control-Expose-Headers': 'content-type, x-request-id',
};

// Shared infrastructure — safe to reuse across requests (stateless)
const aiGatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY');
if (!aiGatewayApiKey) {
    throw new Error('AI_GATEWAY_API_KEY is not set');
}
const aiGateway = createGateway({ apiKey: aiGatewayApiKey });

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin') ?? 'unknown';
    console.log(`🌐 [Chat] ${req.method} request from origin: ${origin}`);

    // Handle CORS preflight FIRST - before any initialization
    if (req.method === 'OPTIONS') {
        console.log('✅ [Chat] Responding to OPTIONS preflight');
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { messages, contextRecipeId } = body;

        if (contextRecipeId) {
            console.log(`📍 [Chat] Context recipe ID: ${contextRecipeId}`);
        }

        // Extract images from the last user message (request-scoped)
        const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
        const images: Array<{ url: string; mediaType: string }> = [];
        if (lastUserMessage?.parts) {
            for (const part of lastUserMessage.parts) {
                if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
                    images.push({ url: part.url, mediaType: part.mediaType });
                }
            }
        }
        if (images.length > 0) {
            console.log(`📷 [Chat] Found ${images.length} images in user message`);
        }

        // Extract the latest user text for the router
        const userText =
            lastUserMessage?.parts
                ?.filter((p: { type: string }) => p.type === 'text')
                .map((p: { text: string }) => p.text)
                .join(' ') ?? '';

        // --- Extract context from conversation history ---
        const searchRecipes = extractSearchRecipes(messages);
        if (searchRecipes.length > 0) {
            console.log(`📋 [Chat] Found ${searchRecipes.length} recipes in search history`);
        }

        const modelMessages = await convertToModelMessages(messages);
        let result;

        if (
            isDirectGeneralChat({
                userText,
                hasContextRecipeId: !!contextRecipeId,
                hasImages: images.length > 0,
                hasSearchResults: searchRecipes.length > 0,
            })
        ) {
            console.log('⚡ [Chat] Direct general chat fast-path hit');
            result = runGeneralChatFlow(aiGateway, modelMessages);
        } else {
            // --- Top-level AI router ---
            const intent = await routeIntent(aiGateway, userText, !!contextRecipeId, images.length > 0, searchRecipes);
            console.log(`🧭 [Chat] Routed to: ${intent.type}`);

            // --- Switch into the appropriate flow ---
            switch (intent.type) {
                case 'search': {
                    console.log('🔍 [Chat] Running search flow');
                    result = runSearchFlow(aiGateway, supabase, modelMessages);
                    break;
                }

                case 'detail': {
                    if (contextRecipeId || searchRecipes.length > 0) {
                        console.log(
                            `📖 [Chat] Running detail flow (contextRecipeId: ${
                                contextRecipeId || 'none'
                            }, searchRecipes: ${searchRecipes.length})`,
                        );
                        result = runDetailFlow(
                            aiGateway,
                            supabase,
                            contextRecipeId || null,
                            searchRecipes,
                            modelMessages,
                        );
                    } else {
                        console.log('⚠️ [Chat] Detail intent but no recipe to resolve — falling back to generalChat');
                        result = runGeneralChatFlow(aiGateway, modelMessages);
                    }
                    break;
                }

                case 'create': {
                    console.log(`✏️ [Chat] Running create flow (images: ${images.length})`);
                    result = runCreateFlow(aiGateway, supabase, modelMessages, images);
                    break;
                }

                case 'generalChat':
                default: {
                    console.log('💬 [Chat] Running general chat flow');
                    result = runGeneralChatFlow(aiGateway, modelMessages);
                    break;
                }
            }
        }

        const response = result.toUIMessageStreamResponse({
            sendReasoning: false,
            originalMessages: messages,
        });

        console.log('✅ [Chat] Stream response created');

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
