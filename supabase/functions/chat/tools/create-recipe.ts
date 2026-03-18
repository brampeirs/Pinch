import { tool } from 'npm:ai';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
    createRecipeToolInputSchema,
    type CreateRecipeResponse,
    type Ingredient,
} from '../../_shared/recipe-schemas.ts';

export function createCreateRecipeTool(supabase: SupabaseClient) {
    return tool({
        description: `Create a new recipe in the database.
Use this when the user wants to save a recipe, provides recipe details (title, ingredients, steps),
or asks to create/add a recipe. Extract the recipe information from the user's message and structure it properly.

The tool will save the recipe and return the created recipe data for display.

**CRITICAL: If you called uploadImage before this, you MUST include the URL it returned!**
The uploadImage tool returns: { success: true, url: "https://..." }
You MUST pass that url value as image_url in the recipe object.
Example: recipe: { title: "My Recipe", image_url: "https://supabase.co/storage/..." }`,
        inputSchema: createRecipeToolInputSchema,
        execute: async ({ recipe, ingredients, steps }) => {
            console.log(
                '📝 createRecipe called:',
                JSON.stringify({
                    title: recipe.title,
                    category_id: recipe.category_id,
                    image_url: recipe.image_url ?? 'NOT PROVIDED',
                    ingredientCount: ingredients.length,
                    stepCount: steps.length,
                }),
            );

            // Auto-assign sort_order to ingredients if not provided
            const ingredientsWithOrder = ingredients.map((ing: Ingredient, idx: number) => ({
                ...ing,
                sort_order: ing.sort_order ?? idx + 1,
            }));

            // Prepare payload for edge function (matches CreateRecipeRequest)
            const { image_url, ...recipeWithoutImage } = recipe;
            const payload = {
                recipe: {
                    ...recipeWithoutImage,
                    // category_id is already a UUID from getCategories tool
                    image_url: image_url, // From uploadImage tool or undefined
                    is_published: true, // Default to published
                },
                ingredients: ingredientsWithOrder,
                steps,
            };

            console.log('📤 Calling create-recipe edge function...');

            // Call the create-recipe edge function
            const { data, error } = await supabase.functions.invoke<CreateRecipeResponse>('create-recipe', {
                body: payload,
            });

            if (error) {
                console.error('❌ Edge function error:', error);
                return {
                    success: false,
                    error: error.message || 'Failed to create recipe',
                    message: 'Sorry, there was an error creating the recipe. Please try again.',
                };
            }

            if (!data?.success) {
                console.error('❌ Recipe creation failed:', data?.error);
                return {
                    success: false,
                    error: data?.error || 'Unknown error',
                    details: data?.details,
                    message: `Failed to create recipe: ${data?.error || 'Unknown error'}`,
                };
            }

            console.log('✅ Recipe created:', data.data?.id);

            // Return structured output for UI to render recipe card
            return {
                success: true,
                message: `Recipe "${data.data?.title}" has been saved!`,
                recipe: {
                    id: data.data?.id,
                    title: data.data?.title,
                    description: data.data?.description,
                    imageUrl: data.data?.image_url,
                    categoryName: data.data?.category_name,
                    prepTime: data.data?.prep_time,
                    cookTime: data.data?.cook_time,
                    servings: data.data?.servings,
                    createdAt: data.data?.created_at,
                },
            };
        },
    });
}
