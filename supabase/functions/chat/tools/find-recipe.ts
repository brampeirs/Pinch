import { tool, embed } from 'npm:ai';
import { openai } from 'npm:@ai-sdk/openai';
import { z } from 'npm:zod';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Helper function to generate embeddings using Vercel AI SDK
async function generateEmbedding(text: string): Promise<number[]> {
  console.log('🔤 Generating embedding for:', text);

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });

  console.log('✅ Embedding received, length:', embedding.length, 'sample:', embedding.slice(0, 3));

  return embedding;
}

export function createFindRecipeTool(supabase: SupabaseClient) {
  return tool({
    description: `Search for recipes in the database using semantic search.
Use this when the user asks for recipes, wants cooking ideas, or mentions ingredients.
Returns matching recipes with title, description, and similarity score.`,
    inputSchema: z.object({
      searchQuery: z.string().describe('Search terms: ingredients, cooking style, cuisine type'),
      category: z
        .string()
        .nullable()
        .optional()
        .describe(
          'ONLY use if user explicitly asks for a category. Options: Pasta, Soups, Salads, Main Dishes, Desserts, Breakfast'
        ),
      tags: z
        .array(z.string())
        .nullable()
        .optional()
        .describe('ONLY use if user explicitly mentions tags like "quick", "vegetarian", "spicy"'),
      maxTime: z
        .number()
        .nullable()
        .optional()
        .describe(
          'ONLY use if user explicitly mentions a time limit. Maximum cooking time in minutes'
        ),
      matchCount: z.number().optional().default(3).describe('Number of results to return (max 3)'),
    }),
    execute: async ({ searchQuery, category, tags, maxTime, matchCount }) => {
      console.log(
        '🔍 findRecipe called:',
        JSON.stringify({ searchQuery, category, tags, maxTime, matchCount })
      );

      const embedding = await generateEmbedding(searchQuery);

      const params = {
        query_embedding: embedding,
        match_count: Math.min(matchCount || 3, 3),
        match_threshold: 0.1,
        filter_category: category || null,
        filter_tags: tags || null,
        filter_max_time: maxTime || null,
      };

      console.log(
        '📤 RPC params:',
        JSON.stringify({
          match_count: params.match_count,
          match_threshold: params.match_threshold,
          filter_category: params.filter_category,
          filter_tags: params.filter_tags,
          filter_max_time: params.filter_max_time,
        })
      );

      const { data: results, error } = await supabase.rpc('search_recipes', params);

      if (error) {
        console.error('❌ Search error:', error);
        return {
          success: false,
          error: error.message,
          recipes: [],
          message: 'Error searching recipes.',
        };
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
          })
        ) || [];

      // Generate a brief message based on results
      const count = recipes.length;
      const message =
        count === 0
          ? 'No recipes found. Try different ingredients or search terms.'
          : count === 1
          ? 'Found 1 recipe:'
          : `Found ${count} recipes:`;

      return {
        success: true,
        message,
        recipes,
      };
    },
  });
}
