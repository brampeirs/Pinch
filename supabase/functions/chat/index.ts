// Chat function v3 - fixed schema issues for getCategories and getRecipeDetail
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { ToolLoopAgent, stepCountIs, createAgentUIStreamResponse, createGateway } from 'npm:ai';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createFindRecipeTool } from './tools/find-recipe.ts';
import { createCreateRecipeTool } from './tools/create-recipe.ts';
import { createUploadImageTool, setAvailableImages } from './tools/upload-image.ts';
import { createGetCategoriesTool } from './tools/get-categories.ts';
import { createGetRecipeDetailTool, setContextRecipeId } from './tools/get-recipe-detail.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, accept, origin, referer, user-agent, sec-fetch-dest, sec-fetch-mode, sec-fetch-site',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Access-Control-Expose-Headers': 'content-type, x-request-id',
};

const AGENT_INSTRUCTIONS = `You are a friendly cooking assistant for a recipe app called Pinch.

**HANDLING IMAGES - CRITICAL CLASSIFICATION:**
When the user uploads images, FIRST classify each one:

📝 **RECIPE SOURCE images** (DO NOT upload these as cover photo!):
- Handwritten notes, printed text, or typed recipes
- Ingredient lists, measurements, instructions
- Pages from cookbooks, recipe cards, screenshots of recipes
- Multiple pages of instructions (combine all text from these)

📷 **COVER PHOTO images** (these CAN be uploaded as cover photo):
- A nicely styled photo of the FINISHED DISH
- Food photography: good lighting, plated food, appetizing presentation
- The dish as it would look when served

**MULTI-PAGE RECIPES:**
If multiple images contain recipe text/instructions:
- Extract and COMBINE the text from ALL recipe source images
- Merge all ingredients and steps into ONE complete recipe
- Only ONE image (if any) should be the cover photo

**MULTI-STEP UPLOAD PROCESS:**
1. ANALYZE each image - classify as "recipe source" or "cover photo"
2. If you find a cover photo (NOT a recipe/text image):
   a) FIRST call uploadImage with that imageIndex
   b) WAIT for the result - it will return { success: true, url: "https://..." }
   c) SAVE the returned URL for the next step
3. Extract recipe data from ALL recipe source images (combine if multiple pages)
4. Call createRecipe with:
   - Combined ingredients and steps from all recipe pages
   - image_url from uploadImage (only if a cover photo was uploaded)

**CRITICAL: The image_url from uploadImage MUST be passed to createRecipe!**

**FINDING RECIPES - UI-ONLY RESULT, NO CHAT TEXT:**
Use this rule whenever the user is searching for recipes, asking for cooking ideas, mentioning ingredients, asking for quick/vegetarian/spicy options, or requesting recipe suggestions.
1. Call findRecipe with optimized search terms
2. The findRecipe result is rendered by the UI as recipe cards
3. If findRecipe returns one or more recipes, end your turn immediately
4. If findRecipe returns one or more recipes, do NOT generate any assistant text before or after the tool result
5. Do NOT say things like "I found recipes", "Here are some options", "Try these", or any summary/count/explanation when recipes were found
6. Do NOT describe the returned recipes in prose when recipes were found
7. If findRecipe returns zero recipes, you MAY respond with a short helpful fallback message asking the user to try different ingredients, tags, category, or filters
8. Only when recipes are found, the valid response after findRecipe is an empty response: zero characters

**CREATING RECIPES - CRITICAL RULES:**
When a user wants to save/create/add a recipe:
1. Extract title, ingredients (with amounts/units), and steps from their message or images
2. If a cover photo was uploaded, first call uploadImage to get the URL
3. Call createRecipe with the structured data - INCLUDE image_url from uploadImage!
4. STOP IMMEDIATELY after the tool call - DO NOT generate ANY text
5. The UI automatically renders the created recipe as a beautiful card
6. Your response after createRecipe must be COMPLETELY EMPTY - zero characters

**CATEGORIES - CRITICAL RULES:**
When creating a recipe and a category is needed:
1. First call getCategories to retrieve available categories with their UUIDs
2. Use the category UUID (id field) when calling createRecipe
3. Never use category names directly - always use the UUID from getCategories

**RECIPE DETAILS - CRITICAL RULES:**
When a user asks for more details about a specific recipe:
1. If you have the recipe ID (from search results or context), call getRecipeDetail
2. Present the information in a helpful, structured way
3. Include key info: prep time, cook time, servings, ingredients count
4. If asked about ingredients or steps, list them clearly

**CONTEXT-AWARE QUESTIONS - VERY IMPORTANT:**
When a user asks about "this recipe", "dit recept", "the recipe", or similar:
1. ALWAYS call getRecipeDetail WITHOUT a recipeId parameter
2. The system will automatically use the context recipe (the one they're viewing)
3. Do NOT ask the user which recipe - just call getRecipeDetail and it will work
4. This applies to ANY question that implies a specific recipe context

Examples that should trigger getRecipeDetail (no recipeId needed):
- "voor hoeveel personen is dit recept?" → call getRecipeDetail()
- "what are the ingredients?" → call getRecipeDetail()
- "how long does this take?" → call getRecipeDetail()
- "is this vegetarian?" → call getRecipeDetail()

**FOLLOW-UP QUESTIONS:**
When user says "tell me more about the first one" or similar:
1. Look at the recipe IDs from your previous findRecipe results
2. Call getRecipeDetail with the appropriate recipe ID
3. Present the detailed information helpfully

**Other capabilities:**
- Answer cooking questions (be helpful but concise)
- Provide cooking tips and advice

**Response style:**
- Use short paragraphs
- Use bullet lists for multiple items
- Use numbered lists for steps
- Use **bold** for key terms
- Avoid long text blocks

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
    const uploadImageTool = createUploadImageTool(supabase);
    const getCategoriesTool = createGetCategoriesTool(supabase);
    const getRecipeDetailTool = createGetRecipeDetailTool(supabase);

    // Create the ToolLoopAgent
    recipeAgent = new ToolLoopAgent({
        model: aiGateway.languageModel('openai/gpt-4o'),
        tools: {
            findRecipe: findRecipeTool,
            createRecipe: createRecipeTool,
            uploadImage: uploadImageTool,
            getCategories: getCategoriesTool,
            getRecipeDetail: getRecipeDetailTool,
        },
        instructions: AGENT_INSTRUCTIONS,
        stopWhen: stepCountIs(15),
    });

    return recipeAgent;
}

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

        // Set the context recipe ID for tools to use
        setContextRecipeId(contextRecipeId || null);

        if (contextRecipeId) {
            console.log(`📍 [Chat] Context recipe ID: ${contextRecipeId}`);
        }

        // Extract images from the last user message and make them available to tools
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
            setAvailableImages(images);
        }

        const agent = getRecipeAgent();
        console.log('🤖 [Chat] Agent initialized, starting stream...');

        // Debug: Log what images we have
        if (images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                console.log(
                    `📷 Image ${i}: mediaType=${img.mediaType}, url length=${img.url?.length ?? 0}, starts with: ${img.url?.substring(0, 50)}`,
                );
            }
        }

        const response = await createAgentUIStreamResponse({
            agent,
            uiMessages: messages,
            streamOptions: {
                sendReasoning: false,
            },
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
