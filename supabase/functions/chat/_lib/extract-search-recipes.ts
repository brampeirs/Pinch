/**
 * Extracts recipe references from the conversation history.
 *
 * Scans UIMessage[] for findRecipe tool-output parts and returns
 * a compact list of { id, title } objects that can be used to:
 * 1. Give the router context about prior search results
 * 2. Resolve recipe IDs when the user refers to "the first one" etc.
 */

interface RecipeRef {
    id: string;
    title: string;
}

// deno-lint-ignore no-explicit-any
export function extractSearchRecipes(messages: any[]): RecipeRef[] {
    const recipes: RecipeRef[] = [];

    for (const msg of messages) {
        if (!msg.parts) continue;
        for (const part of msg.parts) {
            // AI SDK v6 UIMessage format: type is "tool-findRecipe",
            // state is "output-available", output contains { recipes: [...] }
            if (
                part.type === 'tool-findRecipe' &&
                part.state === 'output-available' &&
                part.output?.recipes
            ) {
                for (const r of part.output.recipes) {
                    if (r.id && r.title) {
                        recipes.push({ id: r.id, title: r.title });
                    }
                }
            }
        }
    }

    return recipes;
}

