# Recipe Creation Edge Function + RPC Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor recipe creation to use edge function orchestration + PostgreSQL RPC for atomic DB operations

**Architecture:** Edge function validates request, calls RPC for transactional inserts, triggers async embedding, returns structured response. Client uploads image first, then calls edge function with image URL.

**Tech Stack:** Supabase Edge Functions (Deno), PostgreSQL (PL/pgSQL), Angular 21, TypeScript

---

## Chunk 1: RPC Migration and Edge Function

### File Structure

**New Files:**

- `supabase/migrations/20260317000001_create_recipe_rpc.sql` - PostgreSQL RPC function for atomic recipe creation
- `supabase/functions/create-recipe/index.ts` - Edge function orchestrator

**Modified Files:**

- None in this chunk

---

### Task 1: Create RPC Migration

**Files:**

- Create: `supabase/migrations/20260317000001_create_recipe_rpc.sql`

- [ ] **Step 1: Write RPC function**

Create the migration file with the PostgreSQL function:

```sql
-- ============================================
-- RPC: create_recipe
-- ============================================
-- Creates a recipe with ingredients and steps in a single transaction
-- Returns recipe with category join for card rendering

CREATE OR REPLACE FUNCTION create_recipe(
  recipe_data jsonb,
  ingredients_data jsonb,
  steps_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipe_id uuid;
  v_recipe_record record;
  v_ingredient jsonb;
  v_step jsonb;
BEGIN
  -- Validate required fields
  IF recipe_data->>'title' IS NULL OR trim(recipe_data->>'title') = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  IF jsonb_array_length(ingredients_data) = 0 THEN
    RAISE EXCEPTION 'at least one ingredient is required';
  END IF;

  IF jsonb_array_length(steps_data) = 0 THEN
    RAISE EXCEPTION 'at least one step is required';
  END IF;

  -- Insert recipe
  INSERT INTO recipes (
    title,
    description,
    category_id,
    image_url,
    prep_time,
    cook_time,
    servings,
    is_published,
    created_at,
    updated_at
  ) VALUES (
    recipe_data->>'title',
    recipe_data->>'description',
    (recipe_data->>'category_id')::uuid,
    recipe_data->>'image_url',
    (recipe_data->>'prep_time')::integer,
    (recipe_data->>'cook_time')::integer,
    (recipe_data->>'servings')::integer,
    COALESCE((recipe_data->>'is_published')::boolean, true),
    NOW(),
    NOW()
  ) RETURNING id INTO v_recipe_id;

  -- Insert ingredients
  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(ingredients_data)
  LOOP
    INSERT INTO ingredients (
      recipe_id,
      name,
      amount,
      unit,
      sort_order
    ) VALUES (
      v_recipe_id,
      v_ingredient->>'name',
      (v_ingredient->>'amount')::decimal(10,2),
      v_ingredient->>'unit',
      COALESCE((v_ingredient->>'sort_order')::integer, 0)
    );
  END LOOP;

  -- Insert steps
  FOR v_step IN SELECT * FROM jsonb_array_elements(steps_data)
  LOOP
    INSERT INTO recipe_steps (
      recipe_id,
      step_number,
      description
    ) VALUES (
      v_recipe_id,
      (v_step->>'step_number')::integer,
      v_step->>'description'
    );
  END LOOP;

  -- Fetch recipe with category for response
  SELECT
    r.id,
    r.title,
    r.description,
    r.image_url,
    r.prep_time,
    r.cook_time,
    r.servings,
    r.created_at,
    c.name as category_name
  INTO v_recipe_record
  FROM recipes r
  LEFT JOIN categories c ON c.id = r.category_id
  WHERE r.id = v_recipe_id;

  -- Return as JSONB
  RETURN jsonb_build_object(
    'id', v_recipe_record.id,
    'title', v_recipe_record.title,
    'description', v_recipe_record.description,
    'image_url', v_recipe_record.image_url,
    'prep_time', v_recipe_record.prep_time,
    'cook_time', v_recipe_record.cook_time,
    'servings', v_recipe_record.servings,
    'created_at', v_recipe_record.created_at,
    'category_name', v_recipe_record.category_name
  );
END;
$$;
```

- [ ] **Step 2: Apply migration locally**

Run the migration:

```bash
supabase db reset
```

Expected: Migration applies successfully, database reset complete

- [ ] **Step 3: Test RPC function manually**

Test via Supabase SQL Editor or psql:

```sql
-- Test success case
SELECT create_recipe(
  '{"title": "Test Recipe", "description": "Test description", "servings": 4}'::jsonb,
  '[{"name": "Ingredient 1", "amount": 100, "unit": "g", "sort_order": 0}]'::jsonb,
  '[{"step_number": 1, "description": "Step 1 description"}]'::jsonb
);
```

Expected: Returns JSONB object with recipe data including id, title, etc.

Test validation errors:

```sql
-- Test empty title (should fail)
SELECT create_recipe(
  '{"title": ""}'::jsonb,
  '[{"name": "Ingredient 1"}]'::jsonb,
  '[{"step_number": 1, "description": "Step 1"}]'::jsonb
);

-- Test no ingredients (should fail)
SELECT create_recipe(
  '{"title": "Test"}'::jsonb,
  '[]'::jsonb,
  '[{"step_number": 1, "description": "Step 1"}]'::jsonb
);

-- Test no steps (should fail)
SELECT create_recipe(
  '{"title": "Test"}'::jsonb,
  '[{"name": "Ingredient 1"}]'::jsonb,
  '[]'::jsonb
);
```

Expected: All three queries raise exceptions with appropriate error messages

- [ ] **Step 4: Commit migration**

```bash
git add supabase/migrations/20260317000001_create_recipe_rpc.sql
git commit -m "feat: add create_recipe RPC function for atomic recipe creation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Create Edge Function

**Files:**

- Create: `supabase/functions/create-recipe/index.ts`

- [ ] **Step 1: Create edge function directory**

```bash
mkdir -p supabase/functions/create-recipe
```

- [ ] **Step 2: Write edge function code**

Create `supabase/functions/create-recipe/index.ts`:

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateRecipeRequest {
    recipe: {
        title: string;
        description?: string;
        category_id?: string;
        image_url?: string;
        prep_time?: number;
        cook_time?: number;
        servings?: number;
        is_published?: boolean;
    };
    ingredients: Array<{
        name: string;
        amount?: number;
        unit?: string;
        sort_order?: number;
    }>;
    steps: Array<{
        step_number: number;
        description: string;
    }>;
}

interface CreateRecipeResponse {
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

/**
 * Validate request payload
 */
function validateRequest(req: CreateRecipeRequest): { valid: boolean; error?: string; field?: string } {
    // Validate recipe.title
    if (!req.recipe.title || req.recipe.title.trim().length === 0) {
        return { valid: false, error: 'Title is required', field: 'recipe.title' };
    }
    if (req.recipe.title.length > 500) {
        return { valid: false, error: 'Title must be less than 500 characters', field: 'recipe.title' };
    }

    // Validate description length
    if (req.recipe.description && req.recipe.description.length > 2000) {
        return { valid: false, error: 'Description must be less than 2000 characters', field: 'recipe.description' };
    }

    // Validate ingredients
    if (!req.ingredients || req.ingredients.length === 0) {
        return { valid: false, error: 'At least one ingredient is required', field: 'ingredients' };
    }
    for (const ing of req.ingredients) {
        if (!ing.name || ing.name.trim().length === 0) {
            return { valid: false, error: 'Ingredient name is required', field: 'ingredients.name' };
        }
    }

    // Validate steps
    if (!req.steps || req.steps.length === 0) {
        return { valid: false, error: 'At least one step is required', field: 'steps' };
    }
    for (const step of req.steps) {
        if (!step.description || step.description.trim().length === 0) {
            return { valid: false, error: 'Step description is required', field: 'steps.description' };
        }
    }

    // Validate numeric fields if provided
    if (req.recipe.prep_time !== undefined && req.recipe.prep_time < 0) {
        return { valid: false, error: 'Prep time must be positive', field: 'recipe.prep_time' };
    }
    if (req.recipe.cook_time !== undefined && req.recipe.cook_time < 0) {
        return { valid: false, error: 'Cook time must be positive', field: 'recipe.cook_time' };
    }
    if (req.recipe.servings !== undefined && req.recipe.servings < 1) {
        return { valid: false, error: 'Servings must be at least 1', field: 'recipe.servings' };
    }

    return { valid: true };
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing environment variables');
        }

        // Parse request body
        const body: CreateRecipeRequest = await req.json();

        // Validate request
        const validation = validateRequest(body);
        if (!validation.valid) {
            const response: CreateRecipeResponse = {
                success: false,
                error: validation.error,
                details: validation.field ? { field: validation.field, message: validation.error! } : undefined,
            };
            return new Response(JSON.stringify(response), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Call RPC function
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_recipe', {
            recipe_data: body.recipe,
            ingredients_data: body.ingredients,
            steps_data: body.steps,
        });

        if (rpcError) {
            throw new Error(`RPC error: ${rpcError.message}`);
        }

        // Fire-and-forget: trigger embedding generation
        const recipeId = rpcData.id;
        supabase.functions.invoke('embed-recipe', { body: { recipe_id: recipeId } }).catch((err) => {
            console.warn('Failed to trigger embedding:', err);
        });

        // Return success response
        const response: CreateRecipeResponse = {
            success: true,
            data: rpcData,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const response: CreateRecipeResponse = {
            success: false,
            error: message,
        };
        return new Response(JSON.stringify(response), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
```

- [ ] **Step 3: Test edge function locally**

Start Supabase locally if not running:

```bash
supabase start
```

Serve the edge function:

```bash
supabase functions serve create-recipe
```

Expected: Function starts serving on localhost

- [ ] **Step 4: Test with curl**

In a new terminal (note: the apikey is Supabase's standard local development anon key, only valid for local testing):

```bash
curl -X POST http://localhost:54321/functions/v1/create-recipe \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -d '{
    "recipe": {
      "title": "Test Recipe from Edge Function",
      "description": "Testing the edge function",
      "servings": 4
    },
    "ingredients": [
      {"name": "Ingredient 1", "amount": 100, "unit": "g", "sort_order": 0}
    ],
    "steps": [
      {"step_number": 1, "description": "Test step 1"}
    ]
  }'
```

Expected: Returns JSON with `{"success": true, "data": {...}}`

- [ ] **Step 5: Commit edge function**

```bash
git add supabase/functions/create-recipe/
git commit -m "feat: add create-recipe edge function

Orchestrates recipe creation with validation, RPC call, and async embedding.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Chunk 2: Client Integration

### File Structure

**Modified Files:**

- `src/app/services/supabase.service.ts` - Update createRecipe() to call edge function
- `src/app/pages/add-recipe/add-recipe.ts` - Move image upload to onImageSelected()

---

### Task 3: Update Supabase Service

**Files:**

- Modify: `src/app/services/supabase.service.ts:134-214`

- [ ] **Step 1: Update createRecipe method**

Replace the existing `createRecipe` method (lines 134-214) with:

```typescript
// ============ CREATE RECIPE ============
async createRecipe(
  recipe: {
    title: string;
    description?: string;
    category_id?: string;
    image_url?: string;
    prep_time?: number;
    cook_time?: number;
    servings?: number;
    is_published?: boolean;
  },
  ingredients: { name: string; amount?: number; unit?: string; sort_order?: number }[],
  steps: { step_number: number; description: string }[]
) {
  // Call edge function instead of direct DB operations
  const { data, error } = await this.supabase.functions.invoke('create-recipe', {
    body: { recipe, ingredients, steps },
  });

  if (error) {
    return { data: null, error };
  }

  // Edge function returns { success: boolean, data?: {...}, error?: string }
  if (!data.success) {
    return { data: null, error: new Error(data.error || 'Unknown error') };
  }

  return { data: data.data, error: null };
}
```

- [ ] **Step 2: Verify the change compiles**

```bash
npm run build
```

Expected: Build completes successfully with no TypeScript errors

- [ ] **Step 3: Commit service changes**

```bash
git add src/app/services/supabase.service.ts
git commit -m "refactor: update createRecipe to call edge function

Replaces direct DB inserts with edge function call for better separation of concerns.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Update Add Recipe Component

**Files:**

- Modify: `src/app/pages/add-recipe/add-recipe.ts:166-187,288-364`

- [ ] **Step 1: Update onImageSelected to upload immediately**

Replace the `onImageSelected` method (lines 166-180) with:

```typescript
async onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) {
    this.imageFile.set(file);

    // Upload immediately - don't wait for save
    this.uploadingImage.set(true);
    const { url, error: uploadError } = await this.supabase.uploadRecipeImage(file);
    this.uploadingImage.set(false);

    if (uploadError) {
      this.error.set('Afbeelding uploaden mislukt: ' + uploadError.message);
      return;
    }

    if (url) {
      this.imageUrl.set(url);
      this.imagePreview.set(url);
    }
  }
}
```

- [ ] **Step 2: Update saveRecipe to remove image upload logic**

Replace the `saveRecipe` method (lines 288-364) with:

```typescript
async saveRecipe() {
  // Validation
  if (!this.title().trim()) {
    this.error.set('Vul een titel in');
    return;
  }

  const validIngredients = this.ingredients().filter((i) => i.name.trim());
  const validSteps = this.steps().filter((s) => s.description.trim());

  if (validIngredients.length === 0) {
    this.error.set('Voeg minstens één ingrediënt toe');
    return;
  }

  if (validSteps.length === 0) {
    this.error.set('Voeg minstens één bereidingsstap toe');
    return;
  }

  this.saving.set(true);
  this.error.set(null);

  // Image already uploaded, just use the URL
  const recipeData = {
    title: this.title(),
    description: this.description() || undefined,
    category_id: this.categoryId() || undefined,
    image_url: this.imageUrl() || undefined,
    prep_time: this.prepTime() ?? undefined,
    cook_time: this.cookTime() ?? undefined,
    servings: this.servings() ?? undefined,
    is_published: true,
  };

  const ingredientsData = validIngredients.map((i, idx) => ({
    name: i.name,
    amount: i.amount ?? undefined,
    unit: i.unit || undefined,
    sort_order: idx,
  }));

  const stepsData = validSteps.map((s, idx) => ({
    step_number: idx + 1,
    description: s.description,
  }));

  // Call create or update based on mode
  const { data, error } = this.isEditMode()
    ? await this.supabase.updateRecipe(this.recipeId()!, recipeData, ingredientsData, stepsData)
    : await this.supabase.createRecipe(recipeData, ingredientsData, stepsData);

  this.saving.set(false);

  if (error) {
    this.error.set('Er ging iets mis: ' + error.message);
    return;
  }

  if (data) {
    this.router.navigate(['/recipes', data.id]);
  }
}
```

- [ ] **Step 3: Verify the change compiles**

```bash
npm run build
```

Expected: Build completes successfully

- [ ] **Step 4: Commit component changes**

```bash
git add src/app/pages/add-recipe/add-recipe.ts
git commit -m "refactor: upload recipe image immediately on selection

Moves image upload from saveRecipe to onImageSelected for better UX and consistency with chat flow.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Chunk 3: Deployment and Testing

### Task 5: Deploy and End-to-End Test

**Files:**

- None (deployment + testing)

- [ ] **Step 1: Deploy migration to remote**

```bash
supabase db push
```

Expected: Migration applies successfully to remote database

- [ ] **Step 2: Deploy edge function to remote**

```bash
supabase functions deploy create-recipe --no-verify-jwt
```

Expected: Function deployed successfully. Note: `--no-verify-jwt` flag used because auth not yet implemented.

- [ ] **Step 3: Start local dev server**

```bash
npm start
```

Expected: Angular dev server starts on http://localhost:4200

- [ ] **Step 4: Test recipe creation flow**

Manual testing steps:

1. Navigate to http://localhost:4200/recipes/new
2. Select an image - verify it uploads immediately (progress indicator shows)
3. Fill in recipe details:
    - Title: "Test Recipe"
    - Description: "Testing the new flow"
    - Add 2 ingredients
    - Add 2 steps
4. Click Save
5. Verify:
    - Redirects to recipe detail page
    - Recipe displays correctly with image
    - All ingredients and steps appear
    - Recipe appears in recipe list

Expected: All verifications pass

- [ ] **Step 5: Verify embedding was generated**

Get the recipe ID from the browser URL (e.g., `/recipes/abc-123-...`), then check via Supabase SQL Editor:

```sql
-- Replace <RECIPE_ID> with the ID from the URL
SELECT recipe_id, content, model, tokens, updated_at
FROM recipe_embeddings
WHERE recipe_id = '<RECIPE_ID>';

-- Or get the most recent recipe's embedding:
SELECT re.recipe_id, r.title, re.model, re.tokens, re.updated_at
FROM recipe_embeddings re
JOIN recipes r ON r.id = re.recipe_id
ORDER BY re.updated_at DESC
LIMIT 1;
```

Expected: Row exists for the recipe, embedding was created within a few seconds

---

## Success Criteria

- [ ] User can create recipe via Angular app
- [ ] Image uploads immediately on selection (not at save time)
- [ ] Recipe appears immediately after save
- [ ] Recipe card renders with all data (title, image, description, etc.)
- [ ] Embedding generates within 5 seconds (check recipe_embeddings table)
- [ ] No orphaned recipes in DB (transaction atomicity works)
- [ ] Edge function returns structured response matching spec
- [ ] RPC function handles validation errors gracefully

## Notes

- **No auth**: Edge function deployed with `--no-verify-jwt` flag (auth to be added later)
- **No tests**: Discovery phase - manual testing sufficient for now
- **Orphaned images**: Accepted limitation - cleanup job to be implemented later
- **Update recipe flow**: Not included in this plan - separate task using same pattern

## Rollback Plan

If issues occur in production:

1. Revert client changes: `git revert <commit-hash>`
2. Deploy reverted client: `npm run build` + deploy
3. Edge function can stay deployed (won't be called by old client)
4. RPC function can stay (no harm if unused)
