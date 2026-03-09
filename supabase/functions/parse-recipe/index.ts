import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import OpenAI from 'jsr:@openai/openai';
import { zodTextFormat } from 'jsr:@openai/openai/helpers/zod';
import { z } from 'jsr:@zod/zod';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Zod schemas voor structured outputs
const IngredientSchema = z.object({
  name: z.string(),
  amount: z.number().nullable(),
  unit: z.string(),
});

const IngredientsResponseSchema = z.object({
  items: z.array(IngredientSchema),
});

const StepSchema = z.object({
  description: z.string(),
});

const StepsResponseSchema = z.object({
  items: z.array(StepSchema),
});

// Type inference from Zod schemas
type ParsedIngredient = z.infer<typeof IngredientSchema>;
type ParsedStep = z.infer<typeof StepSchema>;

interface ParseRequest {
  text: string;
  type: 'ingredients' | 'steps';
}

const INGREDIENTS_PROMPT = `Je bent een assistent die ingrediënten uit tekst extraheert.
Voorbeelden:
"500g pasta" → name: "pasta", amount: 500, unit: "g"
"2 eieren" → name: "eieren", amount: 2, unit: "stuks"
"zout naar smaak" → name: "zout", amount: null, unit: ""
"1 el olijfolie" → name: "olijfolie", amount: 1, unit: "el"`;

const STEPS_PROMPT = `Je bent een assistent die bereidingsstappen uit tekst extraheert.
Splits de tekst in logische stappen. Elke stap moet een duidelijke actie beschrijven.`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { text, type }: ParseRequest = await req.json();

    if (!text || !type) {
      throw new Error('Missing text or type parameter');
    }

    const openai = new OpenAI({ apiKey });

    const schema = type === 'ingredients' ? IngredientsResponseSchema : StepsResponseSchema;
    const schemaName = type === 'ingredients' ? 'ingredients' : 'steps';
    const prompt = type === 'ingredients' ? INGREDIENTS_PROMPT : STEPS_PROMPT;
    const userMessage =
      type === 'ingredients'
        ? `Parse de volgende ingrediënten:\n\n${text}`
        : `Parse de volgende bereidingsstappen:\n\n${text}`;

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const openaiStream = openai.responses.stream({
            model: 'gpt-4o-mini',
            input: [
              { role: 'system', content: prompt },
              { role: 'user', content: userMessage },
            ],
            text: {
              format: zodTextFormat(schema, schemaName),
            },
          });

          openaiStream.on('response.output_text.delta', (event) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta: event.delta })}\n\n`)
            );
          });

          openaiStream.on('response.output_text.done', () => {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          });

          openaiStream.on('response.error', (event) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: String(event.error) })}\n\n`)
            );
            controller.close();
          });

          // Wait for stream to complete
          await openaiStream.finalResponse();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
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
