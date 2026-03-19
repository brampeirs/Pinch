import { tool, embed } from 'npm:ai';
import { z } from 'npm:zod';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { buildSearchQuery } from '../_lib/build-search-query.ts';

interface FindRecipeInput {
    searchQuery: string;
    category?: string | null;
    maxTime?: number | null;
    matchCount?: number;
}

// Helper function to generate embeddings using Vercel AI SDK
async function generateEmbedding(text: string): Promise<number[]> {
    console.log('🔤 Generating embedding for:', text);

    const { embedding } = await embed({
        model: 'openai/text-embedding-3-small',
        value: text,
    });

    console.log('✅ Embedding received, length:', embedding.length, 'sample:', embedding.slice(0, 3));

    return embedding;
}

export function createFindRecipeTool(supabase: SupabaseClient) {
    return tool({
        description: `Search for recipes using semantic search.
Use when user asks for recipes or mentions ingredients. This tool returns a structured output that the UI WILL render as recipe cards. Do NOT generate any text after calling this tool, except if no results.`,
        inputSchema: z.object({
            searchQuery: z
                .string()
                .describe(
                    'Optimized semantic search terms. Never leave empty. If the user only asks for a category, reuse that category here.',
                ),
            category: z
                .string()
                .nullable()
                .optional()
                .describe(
                    'ONLY use if user explicitly asks for a category. Options: Soups, Salads, Main Dishes, Desserts, Breakfast',
                ),
            maxTime: z
                .number()
                .nullable()
                .optional()
                .describe('ONLY use if user explicitly mentions a time limit. Maximum cooking time in minutes'),
            matchCount: z.number().optional().default(3).describe('Number of results to return (max 3)'),
        }),
        execute: async ({ searchQuery, category, maxTime, matchCount }: FindRecipeInput) => {
            console.log('🔍 findRecipe called:', JSON.stringify({ searchQuery, category, maxTime, matchCount }));

            const effectiveSearchQuery = buildSearchQuery({ searchQuery, category, maxTime });

            if (effectiveSearchQuery !== searchQuery.trim()) {
                console.log('🪄 Using fallback semantic query:', effectiveSearchQuery);
            }

            const embedding = await generateEmbedding(effectiveSearchQuery);

            const params = {
                query_embedding: embedding,
                match_count: Math.min(matchCount || 3, 3),
                match_threshold: 0.25,
                filter_category: category || null,
                filter_max_time: maxTime || null,
            };

            console.log(
                '📤 RPC params:',
                JSON.stringify({
                    match_count: params.match_count,
                    match_threshold: params.match_threshold,
                    filter_category: params.filter_category,
                    filter_max_time: params.filter_max_time,
                }),
            );

            const { data: results, error } = await supabase.rpc('search_recipes', params);

            if (error) {
                console.error('❌ Search error:', error);
                return { recipes: [], message: `Search failed: ${error.message}` };
            }

            const recipes =
                results?.map(
                    (r: {
                        id: string;
                        title: string;
                        description: string | null;
                        image_url: string | null;
                        category_name: string | null;
                        similarity: number;
                        prep_time: number | null;
                        cook_time: number | null;
                    }) => ({
                        id: r.id,
                        title: r.title,
                        description: r.description,
                        imageUrl: r.image_url,
                        category: r.category_name,
                        similarity: r.similarity,
                        prepTime: r.prep_time,
                        cookTime: r.cook_time,
                    }),
                ) || [];

            if (recipes.length === 0) {
                console.log('⚠️ No recipes found for query:', effectiveSearchQuery);
                return {
                    recipes: [],
                    message: `No recipes found for "${effectiveSearchQuery}". Suggest the user try different search terms.`,
                };
            }

            return { recipes };
        },
    });
}
