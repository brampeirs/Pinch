import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createGateway, createTextStreamResponse, generateText, stepCountIs } from 'npm:ai';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod';
import { createChooseCoverImageTool } from '../chat/tools/upload-image.ts';
import { createCreateRecipeTool } from '../chat/tools/create-recipe.ts';
import { createGetCategoriesTool } from '../chat/tools/get-categories.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const requestSchema = z.object({
    images: z
        .array(
            z.object({
                url: z.string().url(),
                mediaType: z.string().min(1),
            }),
        )
        .min(1, 'At least one uploaded image is required'),
});

const aiGateway = createGateway({ apiKey: Deno.env.get('AI_GATEWAY_API_KEY')! });
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const createFromImagesPrompt = `You are a recipe creation assistant for a cooking app called Pinch.
Create a recipe from the uploaded images.

Each image is either:
- a recipe source image with text, notes, or cookbook content to extract
- or a finished dish photo that can be used as the recipe cover image

Workflow:
1. Call getCategories to get the available categories.
2. If one image looks like a strong cover photo, call chooseCoverImage with that image index.
3. Extract the full recipe from the uploaded images.
4. Call createRecipe with the extracted recipe data.

Rules:
- Extract all ingredients and all steps. Do not summarize.
- Preserve the original recipe language.
- Estimate description, times, and servings when missing.
- If chooseCoverImage succeeds, you MUST pass its returned url as image_url into createRecipe.
- If no category fits well, use the best available general category.`;

interface CreateRecipeToolSuccessOutput {
    success: true;
    recipe: {
        id: string;
    };
}

type CreateRecipeFromImagesProgressStage =
    | 'images_received'
    | 'analyzing_images'
    | 'extracting_recipe'
    | 'choosing_cover'
    | 'saving_recipe';

type CreateRecipeFromImagesStreamEvent =
    | { type: 'status'; stage: CreateRecipeFromImagesProgressStage }
    | { type: 'result'; recipeId: string }
    | { type: 'error'; message: string };

function isCreateRecipeToolSuccess(output: unknown): output is CreateRecipeToolSuccessOutput {
    if (typeof output !== 'object' || output === null) {
        return false;
    }

    const candidate = output as { success?: unknown; recipe?: { id?: unknown } };
    return candidate.success === true && typeof candidate.recipe?.id === 'string';
}

function createProgressStreamWriter(controller: ReadableStreamDefaultController<string>) {
    const emittedStages = new Set<CreateRecipeFromImagesProgressStage>();
    let closed = false;
    let emittedResult = false;
    let emittedError = false;

    return {
        writeStatus(stage: CreateRecipeFromImagesProgressStage) {
            if (closed || emittedResult || emittedError || emittedStages.has(stage)) {
                return;
            }

            const event: CreateRecipeFromImagesStreamEvent = { type: 'status', stage };
            controller.enqueue(`${JSON.stringify(event)}\n`);
            emittedStages.add(stage);
        },
        writeResult(recipeId: string) {
            if (closed || emittedResult || emittedError) {
                return;
            }

            const event: CreateRecipeFromImagesStreamEvent = { type: 'result', recipeId };
            controller.enqueue(`${JSON.stringify(event)}\n`);
            emittedResult = true;
        },
        writeError(message: string) {
            if (closed || emittedResult || emittedError) {
                return;
            }

            const event: CreateRecipeFromImagesStreamEvent = { type: 'error', message };
            controller.enqueue(`${JSON.stringify(event)}\n`);
            emittedError = true;
        },
        close() {
            if (closed) {
                return;
            }

            closed = true;
            controller.close();
        },
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let images: z.infer<typeof requestSchema>['images'];

    try {
        ({ images } = requestSchema.parse(await req.json()));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ success: false, error: message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const stream = new ReadableStream<string>({
        start(controller) {
            const writer = createProgressStreamWriter(controller);

            void (async () => {
                try {
                    const tools = {
                        getCategories: createGetCategoriesTool(supabase),
                        chooseCoverImage: createChooseCoverImageTool(supabase, images),
                        createRecipe: createCreateRecipeTool(supabase),
                    };

                    let recipeId: string | null = null;

                    writer.writeStatus('images_received');
                    writer.writeStatus('analyzing_images');

                    const result = await generateText({
                        model: aiGateway.languageModel('openai/gpt-4o'),
                        system: createFromImagesPrompt,
                        tools,
                        stopWhen: stepCountIs(7),
                        abortSignal: req.signal,
                        experimental_onToolCallStart: ({ toolCall }) => {
                            if (toolCall.toolName === 'chooseCoverImage') {
                                writer.writeStatus('extracting_recipe');
                                writer.writeStatus('choosing_cover');
                            }

                            if (toolCall.toolName === 'createRecipe') {
                                writer.writeStatus('extracting_recipe');
                                writer.writeStatus('saving_recipe');
                            }
                        },
                        experimental_onToolCallFinish: (event) => {
                            if (
                                event.toolCall.toolName === 'createRecipe' &&
                                event.success &&
                                isCreateRecipeToolSuccess(event.output)
                            ) {
                                const createdRecipeId = event.output.recipe.id;
                                recipeId = createdRecipeId;
                                writer.writeResult(createdRecipeId);
                            }
                        },
                        onStepFinish: () => {
                            writer.writeStatus('extracting_recipe');
                        },
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Create a recipe from these uploaded photos.' },
                                    ...images.map((image: (typeof images)[number]) => ({
                                        type: 'file' as const,
                                        data: image.url,
                                        mediaType: image.mediaType,
                                    })),
                                ],
                            },
                        ],
                    });

                    if (!recipeId) {
                        for (const step of result.steps) {
                            for (const toolResult of step.toolResults) {
                                if (
                                    toolResult.toolName === 'createRecipe' &&
                                    isCreateRecipeToolSuccess(toolResult.output)
                                ) {
                                    const createdRecipeId = toolResult.output.recipe.id;
                                    recipeId = createdRecipeId;
                                    writer.writeResult(createdRecipeId);
                                    break;
                                }
                            }

                            if (recipeId) {
                                break;
                            }
                        }
                    }

                    if (!recipeId) {
                        throw new Error('Recipe creation did not complete successfully');
                    }

                    writer.close();
                } catch (error) {
                    if (!req.signal.aborted) {
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        writer.writeError(message);
                    }

                    writer.close();
                }
            })();
        },
    });

    const response = createTextStreamResponse({ textStream: stream });
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
    });
    headers.set('Content-Type', 'application/x-ndjson; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-transform');

    return new Response(response.body, {
        status: response.status,
        headers,
    });
});
