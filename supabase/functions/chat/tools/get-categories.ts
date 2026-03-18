import { tool } from 'npm:ai';
import { z } from 'npm:zod';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export function createGetCategoriesTool(supabase: SupabaseClient) {
    return tool({
        description: `Get all available recipe categories.
Use this when the user asks about available categories, wants to know what categories exist,
or needs to select a category for a new recipe.
Returns a list of categories with their ID, name, emoji, and description.`,
        inputSchema: z.object({
            _reason: z.string().describe('Reason for calling this tool (can be any text)'),
        }),
        execute: async ({ _reason }) => {
            console.log('📁 getCategories called, reason:', _reason);

            const { data: categories, error } = await supabase
                .from('categories')
                .select('id, name, slug, emoji, description')
                .order('name');

            if (error) {
                console.error('❌ Error fetching categories:', error);
                return {
                    success: false,
                    error: error.message,
                    categories: [],
                    message: 'Er is een fout opgetreden bij het ophalen van categorieën.',
                };
            }

            console.log(`✅ Found ${categories?.length ?? 0} categories`);

            return {
                success: true,
                message: `Er zijn ${categories?.length ?? 0} categorieën beschikbaar.`,
                categories:
                    categories?.map((c) => ({
                        id: c.id,
                        name: c.name,
                        slug: c.slug,
                        emoji: c.emoji,
                        description: c.description,
                    })) ?? [],
            };
        },
    });
}
