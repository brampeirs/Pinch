# Recipe Creation - Edge Function + RPC Design

**Date:** 2026-03-17
**Status:** Approved
**Context:** Discovery phase - refactoring recipe creation from direct Supabase client calls to edge function + RPC architecture

## Overview

Refactor the recipe creation flow to use an edge function for orchestration and a PostgreSQL RPC function for atomic database operations. This enables reuse from multiple clients (Angular app, chat tool) and provides better separation of concerns.

## Architecture

### Flow Diagram

```
Client (Angular/Chat):
1. User selects image → Upload immediately to storage → Get public URL
2. User fills form/chat provides data
3. Call edge function: POST /functions/v1/create-recipe
   ↓ { recipe, ingredients, steps }

Edge Function (create-recipe):
1. Validate request payload
2. Call RPC: create_recipe(recipe_data, ingredients_data, steps_data)
3. Fire-and-forget: invoke embed-recipe edge function
4. Return structured output for card rendering

RPC Function (create_recipe):
1. BEGIN transaction
2. INSERT INTO recipes
3. INSERT INTO ingredients (bulk)
4. INSERT INTO recipe_steps (bulk)
5. COMMIT transaction
6. Return recipe with category join
```

### Component Breakdown

**1. Edge Function: `supabase/functions/create-recipe/index.ts`**

- Validates incoming request
- Orchestrates the creation flow
- Calls RPC function for DB operations
- Triggers async embedding generation
- Returns structured response

**2. RPC Function: `create_recipe(recipe_data, ingredients_data, steps_data)`**

- PostgreSQL function (PL/pgSQL)
- Atomic transaction for all inserts
- Returns JSONB with recipe + category join
- Handles validation at DB level (constraints)

**3. Client Integration**

- `uploadRecipeImage()` - Called immediately on image selection
- `createRecipe()` - Updated to call edge function instead of direct inserts

## Data Models

### Edge Function Request

```typescript
interface CreateRecipeRequest {
    recipe: {
        title: string;
        description?: string;
        category_id?: string;
        image_url?: string; // Already uploaded to storage
        prep_time?: number;
        cook_time?: number;
        servings?: number;
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
```

### Edge Function Response

```typescript
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
```

### RPC Function Signature

```sql
CREATE OR REPLACE FUNCTION create_recipe(
  recipe_data jsonb,
  ingredients_data jsonb,
  steps_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
-- Implementation details in migration file
$$;
```

## Validation & Error Handling

### Server-Side Validation (Edge Function)

```typescript
Required fields:
- recipe.title: min 1 char, max 500 chars
- ingredients: min 1 item, each needs name
- steps: min 1 item, each needs description

Optional fields:
- recipe.description: max 2000 chars
- recipe.image_url: any valid URL (no strict validation)
- prep_time/cook_time/servings: positive integers
```

### Error Scenarios

| Scenario                | Status | Handling                             |
| ----------------------- | ------ | ------------------------------------ |
| Missing required fields | 400    | Return validation error with details |
| RPC transaction fails   | 500    | Return error, image stays orphaned   |
| Embedding fails         | -      | Log warning, don't block creation    |
| Invalid category_id     | 400    | RPC foreign key constraint fails     |
| No authentication       | -      | Allow for now (auth added later)     |

### Transaction Rollback

The RPC function uses a PostgreSQL transaction:

```sql
BEGIN;
  INSERT INTO recipes ... RETURNING id;
  INSERT INTO ingredients ... (uses recipe id);
  INSERT INTO recipe_steps ... (uses recipe id);
COMMIT;
```

If any insert fails, the entire transaction rolls back automatically.

### Orphaned Images

**Accepted limitation:** Images uploaded but not saved in recipes will remain in storage.

**Rationale:**

- User aborts between upload and save
- Recipe creation fails after image upload
- User uploads multiple images, uses only one

**Cleanup strategy (future):**

- Cron job finds images in storage not referenced in recipes table
- Only delete if created > 24 hours ago
- Out of scope for this implementation

## Client Integration

### Current Flow (Before)

```typescript
// add-recipe.ts
async saveRecipe() {
  // 1. Upload image
  if (this.imageFile()) {
    const { url } = await this.supabase.uploadRecipeImage(this.imageFile()!);
    finalImageUrl = url;
  }

  // 2. Direct DB operations
  const { data } = await this.supabase
    .from('recipes')
    .insert(recipeData)
    .select()
    .single();

  // 3. Insert ingredients
  await this.supabase.from('ingredients').insert(...);

  // 4. Insert steps
  await this.supabase.from('recipe_steps').insert(...);

  // 5. Fire-and-forget embedding
  this.supabase.embedRecipe(data.id);
}
```

### New Flow (After)

```typescript
// add-recipe.ts
async onImageSelected(event: Event) {
  const file = event.target.files?.[0];

  // Upload immediately - don't wait for save
  this.uploadingImage.set(true);
  const { url, error } = await this.supabase.uploadRecipeImage(file);
  this.uploadingImage.set(false);

  if (url) {
    this.imageUrl.set(url);
    this.imagePreview.set(url);
  }
}

async saveRecipe() {
  // Image already uploaded, just use the URL
  const recipeData = {
    title: this.title(),
    description: this.description() || undefined,
    category_id: this.categoryId() || undefined,
    image_url: this.imageUrl() || undefined,
    prep_time: this.prepTime() ?? undefined,
    cook_time: this.cookTime() ?? undefined,
    servings: this.servings() ?? undefined,
  };

  // Call edge function (via service method)
  const { data, error } = await this.supabase.createRecipe(
    recipeData,
    ingredientsData,
    stepsData
  );

  if (data) {
    this.router.navigate(['/recipes', data.id]);
  }
}
```

```typescript
// supabase.service.ts
async createRecipe(
  recipe: { title: string; ... },
  ingredients: { name: string; ... }[],
  steps: { step_number: number; ... }[]
) {
  // Call edge function instead of direct DB operations
  const { data, error } = await this.supabase.functions.invoke('create-recipe', {
    body: { recipe, ingredients, steps }
  });

  return { data: data?.data || null, error };
}
```

## Key Decisions & Trade-offs

### 1. Image Upload Timing

**Decision:** Upload image immediately on selection, before save.

**Rationale:**

- Better UX - instant feedback, progress indication
- Smaller edge function payload (URL vs base64)
- Consistent flow for Angular and Chat clients
- Retry logic - can retry recipe creation without re-uploading

**Trade-off:** Orphaned images if user cancels (acceptable - cleanup later)

### 2. RPC vs Direct Inserts in Edge Function

**Decision:** Use RPC function for database operations.

**Rationale:**

- Atomic transaction - PostgreSQL native guarantees
- Reusable from multiple edge functions
- Clear separation: edge function = orchestration, RPC = data
- Better for complex DB operations in future

**Trade-off:** Extra hop (edge → RPC) vs direct (edge → DB)

### 3. Embedding Generation

**Decision:** Fire-and-forget, don't block recipe creation.

**Rationale:**

- Embedding can take 1-3 seconds
- Not critical for recipe creation success
- User gets immediate feedback
- Retry on failure is easier async

**Trade-off:** Recipe briefly not searchable until embedding completes

### 4. No Authentication (Now)

**Decision:** Deploy edge function without JWT verification.

**Rationale:**

- Discovery phase - auth not implemented yet
- Will add later when user system is ready
- Edge function prepared for auth (can add check easily)

**Trade-off:** Anyone can create recipes (acceptable for now)

### 5. No Tests (Now)

**Decision:** Skip unit/integration tests initially.

**Rationale:**

- Discovery phase - iterating quickly
- Manual testing sufficient for validation
- Will add tests when design stabilizes

**Trade-off:** Less confidence in refactors (acceptable risk)

## Future Enhancements

**Out of scope for this implementation:**

1. **Orphaned Image Cleanup**
    - Cron job to find unused images in storage
    - Delete images not in recipes table after 24h

2. **Authentication**
    - JWT verification in edge function
    - User ID from auth context
    - RLS policies for recipe ownership

3. **Rate Limiting**
    - Prevent abuse (e.g., spam recipe creation)
    - IP-based or user-based limits

4. **Image Processing**
    - Resize/compress on upload
    - Generate multiple sizes (thumbnail, medium, full)
    - Supabase Image Transformation API or custom edge function

5. **Validation Improvements**
    - Duplicate detection (similar titles)
    - Category existence check before RPC call
    - Image URL validation (ensure from our storage)

6. **Tests**
    - Unit tests for RPC function
    - Integration tests for edge function
    - E2E tests for client flow

## Implementation Checklist

- [ ] Write RPC migration: `create_recipe(recipe_data, ingredients_data, steps_data)`
- [ ] Create edge function: `supabase/functions/create-recipe/index.ts`
- [ ] Update `supabase.service.ts`: modify `createRecipe()` to call edge function
- [ ] Update `add-recipe.ts`: move image upload to `onImageSelected()`
- [ ] Deploy RPC migration
- [ ] Deploy edge function (without auth)
- [ ] Test end-to-end: upload image → fill form → save → verify recipe card
- [ ] Update `updateRecipe()` flow (separate task, same pattern)

## Success Criteria

1. User can create recipe via Angular app
2. Recipe appears immediately after save
3. Recipe card renders with all data
4. Embedding generates within 5 seconds (async)
5. No orphaned recipes in DB (transaction works)
6. Edge function can be called from chat tool (future)
