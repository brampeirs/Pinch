import { generateText, Output } from 'npm:ai';
import { z } from 'npm:zod';

const intentSchema = z.object({
    reasoning: z.string().describe('Brief explanation of why this intent was chosen'),
    type: z.enum(['search', 'detail', 'create', 'generalChat']).describe('The classified intent type'),
});

export type IntentType = z.infer<typeof intentSchema>['type'];
export type IntentResult = z.infer<typeof intentSchema>;

const ROUTER_INSTRUCTIONS = `You are an intent classifier for a cooking/recipe app called Pinch.
Classify the user's latest message into exactly one intent.

**search** — The user wants to find or discover recipes. They mention ingredients, cuisines, meal types, dietary preferences, cooking styles, or ask for recipe suggestions/ideas.
Examples: "quick pasta with tomato", "vegetarian dinner under 30 minutes", "ik zoek een spicy soep", "what can I make with chicken?"

**detail** — The user is asking about a specific recipe they are currently viewing OR referring to a recipe from recent search results. They ask about ingredients, steps, timing, servings, how to make it, or other details of a particular recipe. References like "the first one", "that soup", "how do I make it?" after a search count as detail.
Examples: "what are the ingredients?", "how long does this take?", "voor hoeveel personen is dit recept?", "tell me more about the first one", "hoe maak ik die?", "how do I make the pasta?"

**create** — The user wants to save, create, or add a new recipe. They may paste recipe text, share images of recipes, or explicitly ask to save a recipe.
Examples: "save this recipe", "add a new recipe for banana bread", "here's my grandmother's soup recipe"

**generalChat** — General cooking questions, tips, advice, or conversation that doesn't fit the above categories.
Examples: "what's the difference between baking soda and baking powder?", "how do I sharpen a knife?", "hello"

Classify based on the user's LATEST message, considering conversation context if relevant.
If the context mentions recent search results and the user refers to one of them, classify as **detail**.`;

/**
 * Classifies the user's latest message into one of the supported intents.
 * Uses a lightweight generateText call with structured output — no tools.
 */
export async function routeIntent(
    aiGateway: { languageModel: (model: string) => unknown },
    userMessage: string,
    hasContextRecipeId: boolean,
    hasImages: boolean,
    searchRecipes: { id: string; title: string }[] = [],
): Promise<IntentResult> {
    // Fast-path heuristics that avoid an LLM call
    if (hasImages) {
        return { reasoning: 'User attached images — likely creating a recipe', type: 'create' };
    }

    // Emoji-only messages (e.g. "🍝", "🍜🥗") are always search
    const emojiOnly = /^\p{Emoji_Presentation}[\p{Emoji_Presentation}\s]*$/u;
    if (emojiOnly.test(userMessage.trim())) {
        return { reasoning: 'Emoji-only input — treating as recipe search', type: 'search' };
    }

    // Build context hints for the router
    const contextParts: string[] = [];
    if (hasContextRecipeId) {
        contextParts.push('[User is currently viewing a specific recipe page]');
    }
    if (searchRecipes.length > 0) {
        const list = searchRecipes.map((r, i) => `${i + 1}. ${r.title}`).join(', ');
        contextParts.push(`[Previous search returned these recipes: ${list}]`);
    }
    const contextPrefix = contextParts.length > 0 ? contextParts.join('\n') + '\n\n' : '';

    const { output } = await generateText({
        model: aiGateway.languageModel('openai/gpt-4o-mini'),
        output: Output.object({ schema: intentSchema }),
        messages: [
            { role: 'system', content: ROUTER_INSTRUCTIONS },
            {
                role: 'user',
                content: `${contextPrefix}${userMessage}`,
            },
        ],
    });

    if (!output) {
        console.warn('⚠️ [Router] No structured output — falling back to generalChat');
        return { reasoning: 'Router failed to produce output', type: 'generalChat' };
    }

    console.log(`🧭 [Router] Intent: ${output.type} (${output.reasoning})`);
    return output;
}

