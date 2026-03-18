# SearchRecipes Tool Exploration

## Overview
The recipe search functionality is implemented through the **findRecipe tool** in the AI agent, which uses semantic search with optional filtering. There is also a separate `search-recipes` edge function for the Supabase service.

---

## 1. Fields Returned in Search Results

### From findRecipe Tool (Agent)
The tool returns recipes with these fields:

```typescript
{
  id: string;                    // ✅ Recipe UUID - INCLUDED
  title: string;                 // Recipe name
  description: string | null;    // Recipe description
  imageUrl: string | null;       // Cover image URL
  category: string | null;       // Category name (e.g., "Pasta", "Desserts")
  similarity: number;            // Semantic similarity score (0-1)
  prepTime: number | null;       // Preparation time in minutes
  cookTime: number | null;       // Cooking time in minutes
}
```

### From Database RPC Function
The `search_recipes()` RPC returns:
- `id` (uuid)
- `title` (text)
- `description` (text)
- `image_url` (text)
- `category_name` (text)
- `prep_time` (int)
- `cook_time` (int)
- `tags` (text[])
- `similarity` (float)

---

## 2. Recipe ID in Search Results

**YES - Recipe ID is included!**

- **Field name**: `id` (in tool output)
- **Type**: UUID string
- **Used for**: Linking to recipe detail pages via Angular routing
- **Example**: `<RouterLink [routerLink]="['/recipe', recipe.id]">`

---

## 3. How Agent Presents Search Results

### Agent Instructions (Critical Rules)
From `supabase/functions/chat/index.ts`:

```
**FINDING RECIPES - CRITICAL RULES:**
1. Call findRecipe with optimized search terms
2. STOP IMMEDIATELY after the tool call - DO NOT generate ANY text
3. The UI automatically renders beautiful recipe cards from the tool result
4. ANY text you generate will appear AFTER the cards and look broken/ugly
5. Your response after findRecipe must be COMPLETELY EMPTY - zero characters
```

### UI Rendering Flow
1. **Tool Output**: findRecipe returns `{ success, message, recipes[] }`
2. **Message Generation**: Tool creates brief message:
   - "Found 1 recipe:" (1 result)
   - "Found X recipes:" (multiple results)
   - "No recipes found..." (0 results)
3. **UI Rendering**: Angular template renders recipe cards:
   ```html
   @if (part.type === 'tool-findRecipe' && part.state === 'output-available') {
     @if (output?.recipes?.length) {
       <div class="grid gap-2">
         @for (recipe of output.recipes; track recipe.id) {
           <app-chat-recipe-card [recipe]="recipe" />
         }
       </div>
     }
   }
   ```

---

## 4. Zod Schema for findRecipe Tool

```typescript
inputSchema: z.object({
  searchQuery: z.string()
    .describe('Search terms: ingredients, cooking style, cuisine type'),
  
  category: z.string().nullable().optional()
    .describe('ONLY use if user explicitly asks for a category. 
              Options: Pasta, Soups, Salads, Main Dishes, Desserts, Breakfast'),
  
  tags: z.array(z.string()).nullable().optional()
    .describe('ONLY use if user explicitly mentions tags 
              like "quick", "vegetarian", "spicy"'),
  
  maxTime: z.number().nullable().optional()
    .describe('ONLY use if user explicitly mentions a time limit. 
              Maximum cooking time in minutes'),
  
  matchCount: z.number().optional().default(3)
    .describe('Number of results to return (max 3)')
})
```

### Key Constraints
- `matchCount` defaults to 3 and is capped at 3 (line 52: `Math.min(matchCount || 3, 3)`)
- `match_threshold` is hardcoded to 0.1 in the tool
- Filters are optional and only used when explicitly mentioned by user

---

## 5. Search Flow Summary

1. **User Query** → Agent receives message
2. **Intent Detection** → LLM analyzes intent (search_recipes vs other)
3. **Embedding Generation** → searchQuery converted to vector
4. **RPC Call** → `search_recipes(embedding, filters)` with:
   - `query_embedding`: 1536-dim vector
   - `match_count`: 1-3
   - `match_threshold`: 0.1
   - `filter_category`, `filter_tags`, `filter_max_time`
5. **Results Mapping** → Database fields → Tool output format
6. **UI Rendering** → Recipe cards displayed automatically

---

## File Locations
- **Tool Definition**: `supabase/functions/chat/tools/find-recipe.ts`
- **RPC Function**: `supabase/migrations/20240101000010_hybrid_search.sql`
- **UI Component**: `src/app/components/ai-chat/chat-recipe-card/`
- **Chat Template**: `src/app/components/ai-chat/ai-chat.html` (lines 158-168)

