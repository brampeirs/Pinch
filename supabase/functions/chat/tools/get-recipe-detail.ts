import { tool } from 'npm:ai';
import { z } from 'npm:zod';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Module-level context storage (similar to how images are handled)
let currentContextRecipeId: string | null = null;

export function setContextRecipeId(recipeId: string | null) {
    currentContextRecipeId = recipeId;
    console.log('📍 Context recipe ID set to:', recipeId);
}

export function getContextRecipeId(): string | null {
    return currentContextRecipeId;
}

export function createGetRecipeDetailTool(supabase: SupabaseClient) {
    return tool({
        description: `Get full details for a specific recipe by ID.
Use this when the user asks for more information about a specific recipe,
wants to know ingredients, steps, or cooking times for a recipe,
or asks follow-up questions about a recipe from search results.
If recipeId is not provided, uses the context recipe ID (the recipe the user is currently viewing).
Returns the complete recipe with all ingredients and preparation steps.`,
        inputSchema: z.object({
            recipeId: z
                .string()
                .describe('The UUID of the recipe to retrieve. Pass an empty string to use the context recipe.'),
        }),
        execute: async ({ recipeId }) => {
            // Use provided recipeId, or fall back to module-level context (empty string means use context)
            const targetRecipeId = recipeId && recipeId.trim() !== '' ? recipeId : currentContextRecipeId;

            console.log('📖 getRecipeDetail called with recipeId:', recipeId, 'using targetRecipeId:', targetRecipeId);

            if (!targetRecipeId) {
                return {
                    success: false,
                    message: 'Geen recept ID opgegeven en geen context recept beschikbaar.',
                    recipe: null,
                };
            }

            const { data, error } = await supabase
                .from('recipes')
                .select(
                    `
                    id, title, description, image_url, prep_time, cook_time, servings,
                    category:categories(id, name, emoji),
                    ingredients(name, amount, unit, section_name, sort_order),
                    recipe_steps(step_number, description, section_name)
                `,
                )
                .eq('id', targetRecipeId)
                .single();

            if (error) {
                console.error('❌ Error fetching recipe:', error);
                return {
                    success: false,
                    message: `Recept niet gevonden: ${error.message}`,
                    recipe: null,
                };
            }

            if (!data) {
                return {
                    success: false,
                    message: 'Recept niet gevonden.',
                    recipe: null,
                };
            }

            // Sort ingredients and steps
            const ingredients = (data.ingredients || [])
                .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((ing: any) => ({
                    name: ing.name,
                    amount: ing.amount,
                    unit: ing.unit,
                    sectionName: ing.section_name,
                }));

            const steps = (data.recipe_steps || [])
                .sort((a: any, b: any) => a.step_number - b.step_number)
                .map((step: any) => ({
                    stepNumber: step.step_number,
                    description: step.description,
                    sectionName: step.section_name,
                }));

            console.log(`✅ Found recipe: ${data.title} with ${ingredients.length} ingredients, ${steps.length} steps`);

            const category = data.category as { id: string; name: string; emoji: string } | null;

            return {
                success: true,
                message: `Details voor "${data.title}" opgehaald.`,
                recipe: {
                    id: data.id,
                    title: data.title,
                    description: data.description,
                    imageUrl: data.image_url,
                    category: category?.name || null,
                    categoryEmoji: category?.emoji || null,
                    prepTime: data.prep_time,
                    cookTime: data.cook_time,
                    totalTime: (data.prep_time || 0) + (data.cook_time || 0),
                    servings: data.servings,
                    ingredients,
                    steps,
                },
            };
        },
    });
}

