// tools/optimize-recipe-query.ts (nieuwe tool)
import { tool, generateText } from 'npm:ai';
import { openai } from 'npm:@ai-sdk/openai';
import { z } from 'npm:zod';

const queryOptimizerModel = openai('gpt-4o-mini');

export const optimizeRecipeQueryTool = tool({
  description: `STEP 1: Optimize a user's raw recipe search query before searching.
                This MUST be called FIRST before using findRecipe.
                Extracts key ingredients, cuisine, cooking styles, and dietary needs.
                Returns an optimized query string for better search results.`,
  inputSchema: z.object({
    rawQuery: z.string().describe('The original, unoptimized user recipe search query.'),
  }),
  execute: async ({ rawQuery }) => {
    console.log('✨ Optimaliseert zoekopdracht voor recepten:', rawQuery);

    const { text: optimizedQuery } = await generateText({
      model: queryOptimizerModel,
      prompt: `Convert the user's recipe search query into a clean search query.

RULES:
- ONLY use words/concepts the user actually mentioned
- DO NOT add ingredients, flavors, or details not in the original query
- Keep it simple and direct
- Remove filler words but keep the core meaning
- Return ONLY the optimized query, nothing else

Examples:
- "ik wil soep" → "soup recipe"
- "something with chicken and veggies, italian style" → "Italian chicken vegetables"
- "healthy breakfast no eggs" → "healthy breakfast without eggs"
- "pasta met tomaat" → "tomato pasta"
- "warme soepen" → "warm soup"

User query: "${rawQuery}"
Search query:`,
    });

    console.log('✅ Geoptimaliseerde zoekopdracht:', optimizedQuery);
    return { optimizedQuery: optimizedQuery.trim() };
  },
});
