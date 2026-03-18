import { z } from 'npm:zod';

// ============================================================================
// Shared Zod schemas for recipe creation
// Used by: create-recipe edge function, chat/tools/create-recipe
// ============================================================================

/**
 * Schema for a single ingredient
 */
export const ingredientSchema = z.object({
    name: z.string().min(1, 'Ingredient name is required'),
    amount: z.number().optional(),
    unit: z.string().optional(),
    sort_order: z.number().optional(),
    section_name: z.string().optional(), // e.g., "De Saus", "Het Deeg"
});

/**
 * Schema for a single recipe step
 */
export const stepSchema = z.object({
    step_number: z.number(),
    description: z.string().min(1, 'Step description is required'),
    section_name: z.string().optional(), // e.g., "Voorbereiding", "De Saus"
});

/**
 * Schema for the recipe object (used by edge function)
 * Contains category_id (UUID) for database storage
 */
export const recipeSchema = z.object({
    title: z.string().min(1, 'Title is required').max(500, 'Title must be less than 500 characters'),
    description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
    category_id: z.string().uuid().optional(),
    image_url: z.string().url().optional(),
    prep_time: z.number().min(0, 'Prep time must be positive').optional(),
    cook_time: z.number().min(0, 'Cook time must be positive').optional(),
    servings: z.number().min(1, 'Servings must be at least 1').optional(),
    is_published: z.boolean().optional(),
});

/**
 * Schema for the recipe object (used by chat tool)
 * Contains category_id (UUID) - call getCategories first to get available IDs
 */
export const recipeToolSchema = z.object({
    title: z.string().describe('Recipe title, e.g. "Classic Chocolate Cake"'),
    description: z.string().optional().describe('Brief description of the recipe'),
    category_id: z
        .string()
        .uuid()
        .optional()
        .describe('Category UUID from getCategories tool. Call getCategories first to get available IDs.'),
    image_url: z.string().url().optional().describe('URL of the recipe cover image (from uploadImage tool)'),
    prep_time: z.number().optional().describe('Preparation time in minutes'),
    cook_time: z.number().optional().describe('Cooking time in minutes'),
    servings: z.number().optional().describe('Number of servings'),
});

/**
 * Full request schema for create-recipe edge function
 */
export const createRecipeRequestSchema = z.object({
    recipe: recipeSchema,
    ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required'),
    steps: z.array(stepSchema).min(1, 'At least one step is required'),
});

/**
 * Full input schema for chat tool (with category name instead of UUID)
 */
export const createRecipeToolInputSchema = z.object({
    recipe: recipeToolSchema,
    ingredients: z
        .array(
            ingredientSchema.extend({
                name: z.string().describe('Ingredient name, e.g. "flour", "butter"'),
                amount: z.number().optional().describe('Quantity amount, e.g. 2, 0.5'),
                unit: z.string().optional().describe('Unit of measurement, e.g. "cups", "tbsp", "g"'),
                sort_order: z.number().optional().describe('Order in the list (auto-assigned if not provided)'),
                section_name: z
                    .string()
                    .optional()
                    .describe('Section name for grouping, e.g. "De Saus", "Het Deeg". Use for complex recipes.'),
            }),
        )
        .min(1)
        .describe('List of ingredients'),
    steps: z
        .array(
            stepSchema.extend({
                step_number: z.number().describe('Step number (1, 2, 3, ...)'),
                description: z.string().describe('Detailed instruction for this step'),
                section_name: z
                    .string()
                    .optional()
                    .describe('Section name for grouping, e.g. "Voorbereiding", "De Saus". Use for complex recipes.'),
            }),
        )
        .min(1)
        .describe('Step-by-step instructions'),
});

// ============================================================================
// TypeScript types inferred from Zod schemas
// ============================================================================

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeTool = z.infer<typeof recipeToolSchema>;
export type CreateRecipeRequest = z.infer<typeof createRecipeRequestSchema>;
export type CreateRecipeToolInput = z.infer<typeof createRecipeToolInputSchema>;

/**
 * Response type from create-recipe edge function
 */
export interface CreateRecipeResponse {
    success: boolean;
    data?: {
        id: string;
        title: string;
        description: string | null;
        image_url: string | null;
        category_name: string | null;
        prep_time: number | null;
        cook_time: number | null;
        servings: number | null;
        created_at: string;
    };
    error?: string;
    details?: {
        field: string;
        message: string;
    };
}
