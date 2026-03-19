import { streamText, stepCountIs, type ModelMessage } from 'npm:ai';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { createGetRecipeDetailTool } from '../tools/get-recipe-detail.ts';

const DETAIL_PROMPT_BASE = `You are a friendly cooking assistant for a recipe app called Pinch.
The user is asking about a specific recipe. Answer their questions about it.

**RULES:**
1. ALWAYS call getRecipeDetail first to fetch the recipe data.
2. Answer concisely using the returned data. Do NOT invent information that is not in the recipe.
3. If the user asks about ingredients, list them clearly with amounts and units.
4. If the user asks about steps, list them in order.
5. If the user asks about timing, servings, or categories, use the recipe metadata.
6. Respond in the same language the user writes in.
7. Keep answers short and helpful — no filler text.
`;

function buildDetailPrompt(contextRecipeId: string | null, searchRecipes: { id: string; title: string }[]): string {
    const parts = [DETAIL_PROMPT_BASE];

    if (contextRecipeId) {
        parts.push(`The user is currently viewing a recipe. Call getRecipeDetail with an empty recipeId to fetch it.`);
    }

    if (searchRecipes.length > 0) {
        const list = searchRecipes.map((r, i) => `${i + 1}. "${r.title}" (id: ${r.id})`).join('\n');
        parts.push(
            `Recent search results:\n${list}\n\nIf the user refers to one of these (e.g. "the first one", "that soup"), call getRecipeDetail with the matching recipe ID.`,
        );
    }

    return parts.join('\n\n');
}

/**
 * Runs the detail flow: a single streamText call with the getRecipeDetail tool.
 * stopWhen: stepCountIs(3) — step 1: tool call, step 2: text answer from recipe data.
 *
 * Resolves the recipe from either contextRecipeId (recipe page) or
 * search history (follow-up after a search).
 */
export function runDetailFlow(
    aiGateway: { languageModel: (model: string) => unknown },
    supabase: SupabaseClient,
    contextRecipeId: string | null,
    searchRecipes: { id: string; title: string }[],
    messages: ModelMessage[],
) {
    return streamText({
        model: aiGateway.languageModel('openai/gpt-4o-mini'),
        tools: {
            getRecipeDetail: createGetRecipeDetailTool(supabase, contextRecipeId),
        },
        system: buildDetailPrompt(contextRecipeId, searchRecipes),
        messages,
        stopWhen: stepCountIs(3),
    });
}
