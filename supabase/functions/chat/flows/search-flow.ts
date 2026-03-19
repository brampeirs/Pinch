import { streamText, stepCountIs, type ModelMessage } from 'npm:ai';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { createFindRecipeTool } from '../tools/find-recipe.ts';

const SEARCH_PROMPT = `You are a recipe search assistant for a cooking app called Pinch.
Your ONLY job is to translate the user's request into a single findRecipe call.

**RULES:**
1. Call findRecipe exactly ONCE with optimized search terms.
1a. searchQuery must NEVER be empty. If the user only gives a category or filter, use a broad semantic query such as the category name itself.
2. The UI renders findRecipe results as recipe cards — you do NOT need to describe them.
3. After calling findRecipe:
   - If results were found: produce ZERO assistant text. No summary, no "here are some options", nothing.
   - If zero results: respond with a short helpful message suggesting the user try different terms, in the same language they used.
4. Do NOT call findRecipe more than once per request.
5. Respond in the same language the user writes in.
`;

/**
 * Runs the search flow: a single streamText call with the findRecipe tool.
 * maxSteps: 3 — step 1: tool call, step 2: process result + optional text response.
 * (streamText counts the initial generation + each tool round-trip as separate steps)
 */
export function runSearchFlow(
    aiGateway: { languageModel: (model: string) => unknown },
    supabase: SupabaseClient,
    messages: ModelMessage[],
) {
    return streamText({
        model: aiGateway.languageModel('openai/gpt-4o-mini'),
        tools: {
            findRecipe: createFindRecipeTool(supabase),
        },
        system: SEARCH_PROMPT,
        messages,
        stopWhen: stepCountIs(3),
    });
}
