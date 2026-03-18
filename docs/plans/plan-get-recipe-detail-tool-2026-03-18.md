# Implementatieplan: getRecipeDetail Tool

## 1. Samenvatting

Dit plan beschrijft de implementatie van een `getRecipeDetail` tool voor de chat agent, waarmee de AI volledige receptinformatie kan ophalen inclusief ingrediënten en bereidingsstappen.

### Doelen
- Agent kan receptdetails ophalen op basis van recipe ID
- Ondersteuning voor vervolgvragen over zoekresultaten ("vertel meer over de eerste")
- Context-aware chat op de receptdetailpagina
- Gestructureerde data teruggeven voor rijke antwoorden

### Use Cases
1. **Vervolgvragen na zoeken**: Gebruiker vraagt "vertel meer over de eerste" → agent haalt details op
2. **Context op detailpagina**: Chat weet welk recept de gebruiker bekijkt

---

## 2. Bestanden

### Nieuw aan te maken
| Bestand | Beschrijving |
|---------|-------------|
| `supabase/functions/chat/tools/get-recipe-detail.ts` | De nieuwe tool |

### Aan te passen
| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/chat/index.ts` | Tool registreren + context extractie |
| `src/app/components/ai-chat/ai-chat.ts` | `contextRecipeId` input toevoegen |
| `src/app/pages/recipe-detail/recipe-detail.html` | Chat component met recipeId |

---

## 3. Implementatie Stappen

### Stap 1: Tool Aanmaken

**Bestand:** `supabase/functions/chat/tools/get-recipe-detail.ts`

```typescript
import { tool } from 'npm:ai';
import { z } from 'npm:zod';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Type for the experimental context
interface RecipeContext {
    contextRecipeId?: string;
}

export function createGetRecipeDetailTool(supabase: SupabaseClient) {
    return tool({
        description: `Get full details for a specific recipe by ID.
Use this when the user asks for more information about a specific recipe,
wants to know ingredients, steps, or cooking times for a recipe,
or asks follow-up questions about a recipe from search results.
If recipeId is not provided, uses the context recipe ID (the recipe the user is currently viewing).
Returns the complete recipe with all ingredients and preparation steps.`,
        parameters: z.object({
            recipeId: z.string().uuid().optional()
                .describe('The UUID of the recipe to retrieve. If not provided, uses the context recipe.'),
        }),
        execute: async ({ recipeId }, { experimental_context }) => {
            // Use provided recipeId, or fall back to context
            const ctx = experimental_context as RecipeContext | undefined;
            const targetRecipeId = recipeId || ctx?.contextRecipeId;

            if (!targetRecipeId) {
                return {
                    success: false,
                    message: 'Geen recept ID opgegeven en geen context recept beschikbaar.',
                    recipe: null,
                };
            }

            console.log('📖 getRecipeDetail called for:', targetRecipeId);

            const { data, error } = await supabase
                .from('recipes')
                .select(`
                    id, title, description, image_url, prep_time, cook_time, servings,
                    category:categories(id, name, emoji),
                    ingredients(name, amount, unit, section_name, sort_order),
                    recipe_steps(step_number, description, section_name)
                `)
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

            // Sorteer ingrediënten en stappen
            const ingredients = (data.ingredients || [])
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((ing) => ({
                    name: ing.name,
                    amount: ing.amount,
                    unit: ing.unit,
                    sectionName: ing.section_name,
                }));

            const steps = (data.recipe_steps || [])
                .sort((a, b) => a.step_number - b.step_number)
                .map((step) => ({
                    stepNumber: step.step_number,
                    description: step.description,
                    sectionName: step.section_name,
                }));

            console.log(`✅ Found recipe: ${data.title} with ${ingredients.length} ingredients, ${steps.length} steps`);

            return {
                success: true,
                message: `Details voor "${data.title}" opgehaald.`,
                recipe: {
                    id: data.id,
                    title: data.title,
                    description: data.description,
                    imageUrl: data.image_url,
                    category: data.category?.name || null,
                    categoryEmoji: data.category?.emoji || null,
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
```

---

### Stap 2: Tool Registreren in index.ts

**Bestand:** `supabase/functions/chat/index.ts`

**Wijzigingen:**

1. Import toevoegen (regel 7):
```typescript
import { createGetRecipeDetailTool } from './tools/get-recipe-detail.ts';
```

2. Tool instantiëren (na regel 112):
```typescript
const getRecipeDetailTool = createGetRecipeDetailTool(supabase);
```

3. Tool registreren in agent (regel 117-122):
```typescript
tools: {
    findRecipe: findRecipeTool,
    createRecipe: createRecipeTool,
    uploadImage: uploadImageTool,
    getCategories: getCategoriesTool,
    getRecipeDetail: getRecipeDetailTool,  // Nieuw
},
```

---

### Stap 3: Agent Instructies Uitbreiden

**Bestand:** `supabase/functions/chat/index.ts`

Voeg toe aan `AGENT_INSTRUCTIONS` (na "FINDING RECIPES" sectie):

```typescript
**RECIPE DETAILS - CRITICAL RULES:**
When a user asks for more details about a specific recipe:
1. If you have the recipe ID (from search results or context), call getRecipeDetail
2. Present the information in a helpful, structured way
3. Include key info: prep time, cook time, servings, ingredients count
4. If asked about ingredients or steps, list them clearly
5. When context provides a recipeId, use it to answer questions about "this recipe"

**FOLLOW-UP QUESTIONS:**
When user says "tell me more about the first one" or similar:
1. Look at the recipe IDs from your previous findRecipe results
2. Call getRecipeDetail with the appropriate recipe ID
3. Present the detailed information helpfully
```

---

### Stap 4: Experimental Context Doorgeven

**Bestand:** `supabase/functions/chat/index.ts`

De AI SDK ondersteunt `experimental_context` om extra data direct door te geven aan tools. Dit is de eenvoudigste manier om context beschikbaar te maken in tool execute functies.

**In de request handler (rond regel 172):**

```typescript
// Extract contextRecipeId from request body
const { messages, contextRecipeId } = body;

// Build experimental context if we have a recipe ID
const experimental_context = contextRecipeId
    ? { contextRecipeId }
    : undefined;

if (contextRecipeId) {
    console.log(`📍 [Chat] Context recipe ID: ${contextRecipeId}`);
}

const response = await createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    experimental_context, // Pass context to agent/tools
    streamOptions: {
        sendReasoning: true,
    },
});
```

**Belangrijk:** De destructuring van `body` aanpassen:
```typescript
// Was:
const { messages } = body;

// Wordt:
const { messages, contextRecipeId } = body;
```

---

### Stap 5: Frontend - Chat Component Input

**Bestand:** `src/app/components/ai-chat/ai-chat.ts`

1. Voeg input toe (na regel 30):
```typescript
// Context: which recipe the user is viewing (optional)
contextRecipeId = input<string | null>(null);
```

2. Pas `sendMessage()` aan om `body` mee te sturen:

De AI SDK `sendMessage()` ondersteunt een `body` property waarmee extra data naar de backend wordt gestuurd. Dit wordt samengevoegd met de standaard request body:

```typescript
sendMessage() {
    const message = this.inputMessage().trim();
    const images = this.completedImageUrls();
    const recipeId = this.contextRecipeId();

    // Build file parts from uploaded URLs
    const fileParts = images.map(({ url, mediaType }) => ({
        type: 'file' as const,
        mediaType,
        url,
    }));

    // Build body with recipe context
    const body = recipeId ? { contextRecipeId: recipeId } : undefined;

    // Send message with body containing contextRecipeId
    if (message && fileParts.length > 0) {
        this.chat.sendMessage(
            { parts: [{ type: 'text', text: message }, ...fileParts] as any },
            { body }
        );
    } else if (fileParts.length > 0) {
        this.chat.sendMessage(
            { parts: fileParts as any },
            { body }
        );
    } else if (message) {
        this.chat.sendMessage(
            { text: message },
            { body }
        );
    }

    // Reset state...
}
```

**Let op:** De `body` property wordt gebruikt om extra data naar de backend te sturen. Dit wordt samengevoegd met de standaard request body (die `messages` bevat).

---

### Stap 6: Recipe Detail Page - Chat Integratie

**Bestand:** `src/app/pages/recipe-detail/recipe-detail.ts`

1. Import chat component:
```typescript
import { AiChat } from '../../components/ai-chat/ai-chat';
```

2. Voeg toe aan imports array:
```typescript
@Component({
    selector: 'app-recipe-detail',
    imports: [RouterLink, AiChat],  // AiChat toegevoegd
    ...
})
```

**Bestand:** `src/app/pages/recipe-detail/recipe-detail.html`

Voeg de chat component toe (aan het einde, voor de laatste `}`):
```html
<!-- Chat met recipe context -->
<app-ai-chat [contextRecipeId]="recipe()?.id ?? null" />
```

---

## 4. Testing Scenarios

### Scenario 1: Vervolgvragen na zoeken
1. Open de chat
2. Vraag: "Zoek pasta recepten"
3. Wacht op resultaten (bijv. 3 recepten)
4. Vraag: "Vertel me meer over de eerste"
5. **Verwacht:** Agent roept `getRecipeDetail` aan met het juiste ID
6. **Verwacht:** Gedetailleerde informatie wordt getoond

### Scenario 2: Context op detailpagina
1. Navigeer naar `/recipes/[id]`
2. Open de chat
3. Vraag: "Hoeveel ingrediënten heeft dit recept?"
4. **Verwacht:** Agent weet welk recept bedoeld wordt
5. **Verwacht:** Correct aantal ingrediënten wordt genoemd

### Scenario 3: Specifieke vragen
1. Zoek een recept
2. Vraag: "Wat zijn de bereidingsstappen voor [titel]?"
3. **Verwacht:** Stappen worden getoond

### Scenario 4: Foutafhandeling
1. Vraag details voor een niet-bestaand ID
2. **Verwacht:** Nette foutmelding

---

## 5. Geschatte Tijd

| Onderdeel | Tijd |
|-----------|------|
| Tool aanmaken (`get-recipe-detail.ts`) | 30 min |
| Tool registreren + agent instructies | 15 min |
| experimental_context backend | 15 min |
| Frontend chat input | 20 min |
| Recipe detail integratie | 15 min |
| Testen + debuggen | 25 min |
| **Totaal** | **~2 uur** |

### Complexiteit: Laag-Medium
- Volgt bestaand patroon (andere tools)
- Eenvoudig concept: `experimental_context` doorgeven aan tools
- Integratie met bestaande frontend

---

## 6. Rollback Plan

### Backend
1. Verwijder import en registratie in `index.ts`
2. Verwijder `tools/get-recipe-detail.ts`
3. Verwijder `experimental_context` logica uit request handler
4. Verwijder toegevoegde agent instructies
5. Revert body destructuring (verwijder `contextRecipeId`)
6. Deploy opnieuw

### Frontend
1. Verwijder `contextRecipeId` input uit `ai-chat.ts`
2. Verwijder chat component uit `recipe-detail.html`
3. Revert `sendMessage()` wijzigingen (verwijder `body`)

---

## 7. Toekomstige Uitbreidingen

1. **Nutritie-informatie**: Calorieën, macros per ingredient
2. **Schaling**: Ingrediënten automatisch herberekenen voor x porties
3. **Timer integratie**: "Start timer voor stap 3" functionaliteit
4. **Vergelijking**: "Vergelijk dit recept met [ander recept]"

