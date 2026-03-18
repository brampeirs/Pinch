# Implementatieplan: getRecipeCategories Tool & createRecipe Verbetering

**Datum:** 18 maart 2026  
**Geschatte doorlooptijd:** 45-60 minuten  
**Complexiteit:** Laag

---

## 1. Overzicht

### Doelen
1. Een nieuwe `getRecipeCategories` tool toevoegen aan de chat agent die alle beschikbare categorieën retourneert
2. De `createRecipe` tool aanpassen om een categorie UUID te accepteren in plaats van een categorienaam, waardoor de extra database lookup wordt geëlimineerd

### Voordelen
- **Efficiëntie:** Geen dubbele database calls meer bij het aanmaken van recepten
- **Betrouwbaarheid:** Directe UUID-referentie voorkomt fouten door typo's in categorienamen
- **Flexibiliteit:** Agent kan categorieën opvragen en presenteren aan gebruiker

---

## 2. Vereisten

- Geen extra dependencies nodig (gebruikt bestaande `zod` en `ai` packages)
- Geen database migraties vereist (tabel `categories` bestaat al)

---

## 3. Implementatiestappen

### Stap 1: Nieuw bestand `get-categories.ts` aanmaken
**Bestand:** `supabase/functions/chat/tools/get-categories.ts`  
**Geschatte tijd:** 10 minuten

Maak een nieuwe tool die alle categorieën ophaalt uit de database:

```typescript
import { tool } from 'npm:ai';
import { z } from 'npm:zod';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export function createGetCategoriesTool(supabase: SupabaseClient) {
    return tool({
        description: `Get all available recipe categories.
Use this when the user asks about available categories, wants to know what categories exist,
or needs to select a category for a new recipe.
Returns a list of categories with their ID, name, emoji, and description.`,
        parameters: z.object({}),
        execute: async () => {
            console.log('📁 getCategories called');

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
                categories: categories?.map((c) => ({
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
```

---

### Stap 2: Schema aanpassen in `recipe-schemas.ts`
**Bestand:** `supabase/functions/_shared/recipe-schemas.ts`  
**Geschatte tijd:** 10 minuten

Wijzig `recipeToolSchema` om `category_id` te accepteren in plaats van `category`:

**Huidige code (regels 48-59):**
```typescript
export const recipeToolSchema = z.object({
    title: z.string().describe('Recipe title, e.g. "Classic Chocolate Cake"'),
    description: z.string().optional().describe('Brief description of the recipe'),
    category: z
        .string()
        .optional()
        .describe('Category name: Pasta, Soups, Salads, Main Dishes, Desserts, or Breakfast'),
    image_url: z.string().url().optional().describe('URL of the recipe cover image (from uploadImage tool)'),
    prep_time: z.number().optional().describe('Preparation time in minutes'),
    cook_time: z.number().optional().describe('Cooking time in minutes'),
    servings: z.number().optional().describe('Number of servings'),
});
```

**Nieuwe code:**
```typescript
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
```

---

### Stap 3: `create-recipe.ts` tool aanpassen
**Bestand:** `supabase/functions/chat/tools/create-recipe.ts`  
**Geschatte tijd:** 15 minuten

Verwijder de category lookup logica en gebruik direct de `category_id`:

**Te verwijderen (regels 34-49):**
```typescript
// Lookup category UUID if category name was provided
let categoryId: string | undefined;
if (recipe.category) {
    const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', recipe.category)
        .single();

    if (categoryData) {
        categoryId = categoryData.id;
        console.log(`📁 Found category: ${recipe.category} -> ${categoryId}`);
    } else {
        console.warn(`⚠️ Category not found: ${recipe.category}`);
    }
}
```

**Te wijzigen - logging (regel 26-29):**
```typescript
console.log(
    '📝 createRecipe called:',
    JSON.stringify({
        title: recipe.title,
        category_id: recipe.category_id,  // Was: category: recipe.category
        image_url: recipe.image_url ?? 'NOT PROVIDED',
        ingredientCount: ingredients.length,
        stepCount: steps.length,
    }),
);
```

**Te wijzigen - payload constructie (regels 57-68):**
```typescript
// Prepare payload for edge function (matches CreateRecipeRequest)
const { image_url, ...recipeWithoutImage } = recipe;
const payload = {
    recipe: {
        ...recipeWithoutImage,
        // category_id is nu al een UUID, direct doorgeven
        image_url: image_url,
        is_published: true,
    },
    ingredients: ingredientsWithOrder,
    steps,
};
```

---

### Stap 4: Tool registreren in `index.ts`
**Bestand:** `supabase/functions/chat/index.ts`  
**Geschatte tijd:** 5 minuten

**Import toevoegen (na regel 6):**
```typescript
import { createGetCategoriesTool } from './tools/get-categories.ts';
```

**Tool initialiseren (na regel 105):**
```typescript
const getCategoriesTool = createGetCategoriesTool(supabase);
```

**Tool registreren in agent (regels 110-114):**
```typescript
tools: {
    findRecipe: findRecipeTool,
    createRecipe: createRecipeTool,
    uploadImage: uploadImageTool,
    getCategories: getCategoriesTool,  // Nieuwe tool
},
```

**Agent instructies uitbreiden (rond regel 80):**
Voeg toe aan `AGENT_INSTRUCTIONS`:
```
**CATEGORIES - CRITICAL RULES:**
When creating a recipe and a category is needed:
1. First call getCategories to retrieve available categories with their UUIDs
2. Use the category UUID (id field) when calling createRecipe
3. Never use category names directly - always use the UUID from getCategories
```

---

## 4. Overzicht Bestandswijzigingen

| Actie | Bestand | Beschrijving |
|-------|---------|--------------|
| **NIEUW** | `supabase/functions/chat/tools/get-categories.ts` | Nieuwe tool voor ophalen categorieën |
| **WIJZIG** | `supabase/functions/_shared/recipe-schemas.ts` | `category` → `category_id` in `recipeToolSchema` |
| **WIJZIG** | `supabase/functions/chat/tools/create-recipe.ts` | Verwijder lookup, gebruik direct UUID |
| **WIJZIG** | `supabase/functions/chat/index.ts` | Registreer nieuwe tool + update instructies |

---

## 5. Teststrategie

### 5.1 Handmatige Tests (Lokaal)

**Test 1: getCategories tool**
1. Start de Supabase functies lokaal: `supabase functions serve`
2. Stuur een chatbericht: "Welke categorieën zijn beschikbaar?"
3. Verwacht: Tool retourneert 6 categorieën met id, name, emoji, description
4. Controleer console logs voor `📁 getCategories called` en `✅ Found 6 categories`

**Test 2: createRecipe met category_id**
1. Vraag eerst om categorieën: "Toon me de categorieën"
2. Maak een recept aan: "Maak een pasta recept met de eerste categorie"
3. Verwacht: Agent gebruikt de UUID uit getCategories response
4. Controleer dat er GEEN `category lookup` meer in de logs staat
5. Verifieer dat het recept correct is opgeslagen met category_id

**Test 3: Backward compatibility**
1. Probeer een recept aan te maken zonder category_id
2. Verwacht: Recept wordt succesvol aangemaakt (category_id is optional)

### 5.2 Edge Cases

- [ ] Lege categorieën tabel (zou 0 resultaten moeten retourneren)
- [ ] Ongeldige UUID format in category_id (Zod validatie zou moeten falen)
- [ ] Database connectie fout (error handling testen)

---

## 6. Rollback Plan

Indien er problemen optreden, kunnen de wijzigingen eenvoudig worden teruggedraaid:

1. **Verwijder** `supabase/functions/chat/tools/get-categories.ts`
2. **Revert** `recipe-schemas.ts` naar `category` string in plaats van `category_id` UUID
3. **Revert** `create-recipe.ts` om de category lookup logica terug te zetten
4. **Revert** `index.ts` om de tool registratie te verwijderen

**Git commando's:**
```bash
git checkout HEAD~1 -- supabase/functions/_shared/recipe-schemas.ts
git checkout HEAD~1 -- supabase/functions/chat/tools/create-recipe.ts
git checkout HEAD~1 -- supabase/functions/chat/index.ts
git rm supabase/functions/chat/tools/get-categories.ts
```

---

## 7. Geschatte Inspanning

| Stap | Beschrijving | Tijd |
|------|--------------|------|
| 1 | `get-categories.ts` aanmaken | 10 min |
| 2 | `recipe-schemas.ts` aanpassen | 10 min |
| 3 | `create-recipe.ts` aanpassen | 15 min |
| 4 | `index.ts` aanpassen | 5 min |
| 5 | Handmatig testen | 15-20 min |
| **Totaal** | | **55-60 min** |

**Complexiteit:** Laag - Alle wijzigingen zijn lokaal en volgen bestaande patronen.

---

## 8. Opmerkingen

- De `getCategories` tool heeft geen input parameters nodig (lege `z.object({})`)
- De AI agent instructies moeten duidelijk aangeven dat `getCategories` eerst moet worden aangeroepen
- De bestaande `findRecipe` tool gebruikt nog steeds category **name** voor filtering - dit kan in een vervolgticket worden aangepast indien gewenst

