import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createGateway, streamObject } from 'npm:ai';
import { createOpenAI } from 'npm:@ai-sdk/openai';
import { z } from 'jsr:@zod/zod';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const IngredientSchema = z.object({
    name: z.string(),
    amount: z.number().nullable(),
    unit: z.string(),
    section_name: z.string().nullable(),
});

const IngredientsResponseSchema = z.object({
    items: z.array(IngredientSchema),
});

const StepSchema = z.object({
    description: z.string(),
    section_name: z.string().nullable(),
});

const StepsResponseSchema = z.object({
    items: z.array(StepSchema),
});

interface ParseRequest {
    text: string;
    type: 'ingredients' | 'steps';
}

const INGREDIENTS_PROMPT = `You extract recipe ingredients from raw text for a cooking app.

Rules:
- Return every ingredient in the original order.
- Preserve the original language of ingredient names. Do not translate.
- Detect section headings such as "For the sauce", "The dough", or "Topping" and use them as section_name for the ingredients that follow.
- If there is no section heading, use null for section_name.
- Use title case for section_name when a section exists.
- Set amount to null when no reliable numeric quantity is present.
- Use an empty string for unit when no explicit unit is provided.
- Normalize simple count-based ingredients like "2 eggs" to amount: 2 and unit: "pieces".`;

const STEPS_PROMPT = `You extract recipe preparation steps from raw text for a cooking app.

Rules:
- Split the text into clear, actionable steps in the original order.
- Preserve the original language of the step descriptions. Do not translate.
- Detect section headings such as "Sauce", "Finishing", or "Breadcrumbs" and use them as section_name for the steps that follow.
- If there is no section heading, use null for section_name.
- Use title case for section_name when a section exists.
- Do not omit important details from the source text.`;

function createModel() {
    const gatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY');
    if (gatewayApiKey) {
        const aiGateway = createGateway({ apiKey: gatewayApiKey });
        return aiGateway.languageModel('openai/gpt-4o-mini');
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openAiApiKey) {
        const openai = createOpenAI({ apiKey: openAiApiKey });
        return openai('gpt-4o-mini');
    }

    throw new Error('AI_GATEWAY_API_KEY or OPENAI_API_KEY must be configured');
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { text, type }: ParseRequest = await req.json();

        if (!text || !type) {
            throw new Error('Missing text or type parameter');
        }

        const schema = type === 'ingredients' ? IngredientsResponseSchema : StepsResponseSchema;
        const prompt = type === 'ingredients' ? INGREDIENTS_PROMPT : STEPS_PROMPT;
        const userMessage =
            type === 'ingredients'
                ? `Parse the following ingredients:\n\n${text}`
                : `Parse the following recipe steps:\n\n${text}`;

        const model = createModel();

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    const result = streamObject({
                        model,
                        schema,
                        system: prompt,
                        prompt: userMessage,
                    });

                    for await (const partialObject of result.partialObjectStream) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ partial: partialObject })}\n\n`));
                    }

                    const finalObject = await result.object;
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ partial: finalObject, done: true })}\n\n`),
                    );
                    controller.close();
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Stream error';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
