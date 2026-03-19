import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const requestSchema = z.object({
    recipe_ids: z.array(z.string().uuid()).max(200).optional(),
    limit: z.number().int().positive().max(200).default(25),
    offset: z.number().int().min(0).default(0),
    concurrency: z.number().int().min(1).max(10).default(3),
    dry_run: z.boolean().default(false),
});

type ReembedRequest = z.infer<typeof requestSchema>;

interface RecipeSummary {
    id: string;
    title: string;
}

async function parseBody(req: Request): Promise<ReembedRequest> {
    const raw = await req.text();
    const json = raw.trim().length > 0 ? JSON.parse(raw) : {};
    return requestSchema.parse(json);
}

async function loadRecipes(supabase: ReturnType<typeof createClient>, body: ReembedRequest): Promise<RecipeSummary[]> {
    if (body.recipe_ids && body.recipe_ids.length > 0) {
        const { data, error } = await supabase.from('recipes').select('id, title').in('id', body.recipe_ids).order('id');
        if (error) throw error;
        return data ?? [];
    }

    const end = body.offset + body.limit - 1;
    const { data, error } = await supabase.from('recipes').select('id, title').order('id').range(body.offset, end);
    if (error) throw error;
    return data ?? [];
}

async function invokeEmbed(supabase: ReturnType<typeof createClient>, recipe: RecipeSummary) {
    const startedAt = Date.now();
    const { data, error } = await supabase.functions.invoke('embed-recipe', {
        body: { recipe_id: recipe.id },
    });

    if (error) {
        throw new Error(error.message || `Failed to embed ${recipe.id}`);
    }

    return {
        id: recipe.id,
        title: recipe.title,
        tokens: data?.tokens ?? null,
        elapsedMs: Date.now() - startedAt,
    };
}

async function runPool<T>(items: T[], maxConcurrency: number, worker: (item: T, index: number) => Promise<void>) {
    let index = 0;

    async function consume() {
        while (index < items.length) {
            const currentIndex = index++;
            await worker(items[currentIndex], currentIndex);
        }
    }

    await Promise.all(Array.from({ length: Math.min(maxConcurrency, items.length) }, () => consume()));
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

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing environment variables');
        }

        const body = await parseBody(req);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const recipes = await loadRecipes(supabase, body);

        if (recipes.length === 0) {
            return new Response(JSON.stringify({ success: true, total: 0, message: 'No recipes found.' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (body.dry_run) {
            return new Response(
                JSON.stringify({
                    success: true,
                    dry_run: true,
                    total: recipes.length,
                    recipes,
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                },
            );
        }

        let successCount = 0;
        const failures: Array<{ id: string; title: string; error: string }> = [];
        const results: Array<{ id: string; title: string; tokens: number | null; elapsedMs: number }> = [];

        await runPool(recipes, body.concurrency, async (recipe, currentIndex) => {
            const label = `[${currentIndex + 1}/${recipes.length}] ${recipe.title} (${recipe.id})`;
            try {
                const result = await invokeEmbed(supabase, recipe);
                successCount += 1;
                results.push(result);
                console.log(`✅ ${label} — ${result.elapsedMs}ms${result.tokens ? `, ${result.tokens} tokens` : ''}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failures.push({ id: recipe.id, title: recipe.title, error: message });
                console.error(`❌ ${label} — ${message}`);
            }
        });

        return new Response(
            JSON.stringify({
                success: failures.length === 0,
                total: recipes.length,
                successCount,
                failureCount: failures.length,
                results,
                failures,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ success: false, error: message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});