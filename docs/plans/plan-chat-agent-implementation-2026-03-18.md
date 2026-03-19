# Implementation Plan: Chat Agent Refactor

**Date:** 2026-03-18  
**Depends on:** `docs/plans/plan-chat-agent-architecture-refactor-2026-03-18.md`  
**Planning mode:** Vertical slices only — every step should be small, shippable, and manually testable on its own.

---

## 1. First-pass constraints

Keep these constraints for all slices:

1. **Keep the current Vercel AI SDK-compatible transport**
   - request remains centered on `messages: UIMessage[]`
   - response remains a streamed UI message response

2. **Keep the current tool-part rendering contract in the UI**
   - continue rendering `tool-findRecipe`, `tool-createRecipe`, `tool-uploadImage`, etc.
   - do **not** introduce custom data parts in this pass

3. **Prefer heuristics-first routing**
   - use deterministic routing where practical
   - use LLM interpretation only where it adds clear value

4. **Do not ship purely horizontal refactors by themselves**
   - model-factory work, prompt splitting, and helper extraction should be folded into the first slice that needs them

---

## 2. Target request/response contract

### Request body

Keep the current request model and extend it carefully:

```ts
{
  messages: UIMessage[];
  contextRecipeId?: string | null;
  screenContext?: 'global' | 'recipe-detail' | 'search-results';
  visibleRecipeIds?: string[];
}
```

### Response behavior

Keep returning a **UIMessage stream response** compatible with `@ai-sdk/angular` `Chat` / `DefaultChatTransport`.

Target behavior after all slices:

- `search` and `create`: assistant messages may contain **tool parts only** on success paths
- `detail` and `chat`: assistant messages may contain conversational text, and may also include tool parts

---

## 3. Delivery strategy

This plan is intentionally rewritten as vertical slices instead of large phases.

Each slice must satisfy all of the following before moving on:

- it changes one user journey, or one thin end-to-end path
- it can be merged without waiting for later slices
- it has a clear manual verification scenario
- it preserves existing behavior outside the slice’s scope

Recommended cadence:

1. implement one slice
2. run targeted validation
3. have the user manually test that slice
4. only then move to the next slice

---

## 4. Likely files involved across the slices

### Existing files to modify

- `supabase/functions/chat/index.ts`
- `supabase/functions/chat/tools/upload-image.ts`
- `supabase/functions/chat/tools/get-recipe-detail.ts`
- `supabase/functions/chat/tools/create-recipe.ts`
- `supabase/functions/chat/tools/get-categories.ts`
- `supabase/functions/_shared/recipe-schemas.ts`
- `src/app/components/ai-chat/ai-chat.ts`
- `src/app/components/ai-chat/ai-chat.html`
- `src/app/services/chat-context.service.ts`

### New files that may be introduced incrementally

- `supabase/functions/chat/_lib/chat-request-context.ts`
- `supabase/functions/chat/_lib/model-factory.ts`
- `supabase/functions/chat/_lib/route-intent.ts`
- `supabase/functions/chat/_lib/extract-images.ts`
- `supabase/functions/chat/_lib/resolve-category.ts`
- `supabase/functions/chat/_lib/stream-policy.ts`
- `supabase/functions/chat/flows/search-flow.ts`
- `supabase/functions/chat/flows/create-flow.ts`
- `supabase/functions/chat/flows/detail-flow.ts`
- `supabase/functions/chat/flows/chat-flow.ts`
- `supabase/functions/chat/prompts/base-prompt.ts`
- `supabase/functions/chat/prompts/create-prompt.ts`
- `supabase/functions/chat/prompts/search-prompt.ts`
- `supabase/functions/chat/prompts/detail-prompt.ts`

---

## 5. Vertical slice roadmap

## Slice 1 — Safe request-scoped runtime with no product behavior change

### Goal

Remove shared mutable request state without changing the visible UX yet.

### Scope

- eliminate module-level request state:
  - `availableImages` in `upload-image.ts`
  - `currentContextRecipeId` in `get-recipe-detail.ts`
  - global cached `recipeAgent` in `chat/index.ts`
- instantiate tools and runtime per request
- extract request parsing into helpers only where needed for this slice
- if useful, introduce `chat-request-context.ts` and `model-factory.ts`

### Out of scope

- no routed flows yet
- no new search behavior yet
- no new create workflow yet

### Deliverable

The chat function behaves like today, but no request can leak image state, recipe context, or tool state into another request.

### User test

Run the current chat flows exactly as they work today and verify nothing visibly regressed.

### Validation focus

- repeated chat requests do not reuse stale images
- detail requests do not reuse stale recipe context
- transport stays compatible with Angular chat UI

---

## Slice 2 — Explicit recipe-detail flow

### Goal

Make the recipe-detail journey intentionally request-scoped and testable on its own.

### Scope

- add a dedicated `detail` route
- route to `detail` when `contextRecipeId` or explicit recipe ID is present
- implement detail behavior with this precedence:
  1. explicit recipe ID
  2. `contextRecipeId`
  3. clarification if neither is available
- optionally introduce `detail-flow.ts` and `detail-prompt.ts`

### Out of scope

- no search refactor yet
- no create refactor yet

### Deliverable

Questions asked from a recipe detail page resolve against the correct recipe without relying on hidden global fallback state.

### User test

Open a recipe detail page and ask:

- “what are the ingredients?”
- “how long does this take?”

Then verify the assistant answers about the current recipe only.

### Validation focus

- explicit ID beats page context
- no stale recipe from a previous request is used

---

## Slice 3 — Dedicated search route with current UI contract

### Goal

Make search a separate end-to-end path while preserving the existing card rendering contract.

### Scope

- add `search` intent routing
- introduce `search-flow.ts`
- narrow tools available to the search path
- keep the current tool-part result rendering in the UI
- if useful, introduce `search-prompt.ts`

### Out of scope

- no hard enforcement of tool-only success yet
- no create refactor yet

### Deliverable

Search requests are handled by a dedicated flow instead of the general agent, but results still render in the current recipe-card UI.

### User test

Ask for:

- “quick pasta with tomato”
- “vegetarian dinner under 30 minutes”

Verify recipe cards still render as they do today.

### Validation focus

- search route is selected intentionally
- search still works with current UI components

---

## Slice 4 — Search success path without stray assistant prose

### Goal

Make successful search results controlled by backend policy rather than prompt wording alone.

### Scope

- add `stream-policy.ts` or equivalent logic for search responses
- suppress or avoid unnecessary assistant text on successful search results
- keep fallback conversational behavior for empty or ambiguous search cases

### Implementation note

Start with the lightest option:

- narrow search agent + stream sanitization

If that becomes awkward, switch this slice to:

- structured extraction + direct search execution

### Deliverable

When search finds recipes, the UI shows the recipe cards without extra assistant chatter.

### User test

Repeat the Slice 3 search tests and confirm the success path is effectively UI-only.

### Validation focus

- success search results do not depend only on “do not generate text” prompt wording
- no regression for empty-result or clarification cases

---

## Slice 5 — Create recipe from pasted text

### Goal

Deliver the smallest useful create flow: save a recipe from plain text only.

### Scope

- add `create` intent routing for text-only creation requests
- introduce `create-flow.ts` for the text path
- extract recipe draft from pasted text
- resolve category on the server side before calling `createRecipe`
- keep `createRecipe` semantically simple
- keep `getCategories` available only for explicit user questions

### Schema recommendation

Use the stricter first-pass model:

- orchestration resolves category first
- `createRecipe` receives `category_id` only

### Deliverable

The user can paste a recipe and save it without the normal flow depending on `getCategories` tool choreography.

### User test

Paste a full recipe and ask the assistant to save it.

Verify:

- recipe creation succeeds
- category is resolved when obvious, omitted when unclear

### Validation focus

- text-only create works without image support
- unresolved category does not block the happy path

---

## Slice 6 — Create recipe from a single recipe image

### Goal

Extend the create flow to one-image recipe extraction without yet handling a separate cover image.

### Scope

- introduce `extract-images.ts` if not already present
- classify whether the uploaded image is recipe-source content
- extract a recipe draft from the image
- create the recipe from that extracted draft
- keep image state request-scoped

### Deliverable

The user can upload a single recipe screenshot or photo of recipe text and create a recipe from it.

### User test

Upload one recipe screenshot and ask to create a recipe.

Verify:

- the correct image is used for the current request only
- the recipe is created successfully

### Validation focus

- no stale image reuse from previous requests
- failure mode is graceful if extraction is poor

---

## Slice 7 — Create recipe from recipe image + cover image

### Goal

Finish the create journey by supporting the common two-image case.

### Scope

- classify images into:
  - recipe source images
  - optional cover image
- output a simple structure such as:

```ts
{
  recipeSourceImageIndexes: number[];
  coverImageIndex: number | null;
}
```

- upload the cover image through request-scoped `uploadImage`
- pass the uploaded cover image into recipe creation

### Deliverable

The user can upload recipe text plus a plated-dish image, and the created recipe uses the correct cover image.

### User test

Upload two images:

1. recipe screenshot
2. plated dish image

Ask the assistant to create the recipe and verify the correct cover image is attached.

### Validation focus

- cover image is uploaded from the current request only
- “no cover image detected” remains a valid outcome

---

## Slice 8 — General chat route with smaller prompts

### Goal

Pull non-search, non-create, non-detail conversation into an explicit chat path.

### Scope

- add `chat` route and `chat-flow.ts`
- split prompt responsibilities into smaller files as needed:
  - `base-prompt.ts`
  - `search-prompt.ts`
  - `create-prompt.ts`
  - `detail-prompt.ts`
- keep conversational cooking help working as normal

### Out of scope

- no frontend metadata changes yet

### Deliverable

General cooking questions are handled by a dedicated conversational flow, and prompt responsibilities are smaller and easier to maintain.

### User test

Ask a general question such as:

- “how do I thicken a sauce?”

Verify the answer remains conversational and helpful.

### Validation focus

- routing falls back safely to general chat
- prompt split does not break the other slices

---

## Slice 9 — Optional frontend metadata for better routing

### Goal

Improve routing quality with explicit UI context, without changing the transport model.

### Scope

- in `src/app/components/ai-chat/ai-chat.ts`, optionally send:
  - `screenContext`
  - `visibleRecipeIds`
- optionally extend `chat-context.service.ts`
- keep backend compatible when metadata is absent

### Deliverable

The backend receives clearer page context, improving route selection while staying compatible with the current chat transport contract.

### User test

Verify at least these cases:

- on recipe detail page → detail questions route correctly
- on search/list page → follow-up search requests route correctly

### Validation focus

- metadata is optional
- old clients or missing fields do not break requests

---

## Slice 10 — Hardening, regression checks, and release readiness

### Goal

Stabilize the full refactor after the main user journeys are in place.

### Scope

- add or tighten logs around routing and flow selection
- clean up helper boundaries
- run full smoke checklist
- add any targeted tests that became obvious during earlier slices

### Deliverable

The refactor is ready to ship with confidence, and the team has a clear regression checklist.

### User test

Run the full smoke checklist in Section 7.

### Validation focus

- no cross-request contamination
- all core chat journeys still work

---

## 6. Recommended implementation order

Implement the slices in this order:

1. Slice 1 — safe request-scoped runtime
2. Slice 2 — explicit detail flow
3. Slice 3 — dedicated search route
4. Slice 4 — search success path without stray prose
5. Slice 5 — create from pasted text
6. Slice 6 — create from one recipe image
7. Slice 7 — create from recipe image + cover image
8. Slice 8 — general chat route + prompt split
9. Slice 9 — optional frontend metadata
10. Slice 10 — hardening and regression checks

Why this order:

- correctness and request-safety come first
- the detail flow is the smallest user-visible vertical slice
- search is split into two small slices instead of one risky rewrite
- create is split into text, one-image, then two-image support
- frontend metadata is delayed until the backend paths already exist

---

## 7. Validation plan

## 7.1 Validation after every slice

Run the smallest useful checks for the files touched in that slice.

Baseline checks:

- `npm run build`
- `deno check supabase/functions/chat/index.ts`

Then add targeted `deno check` commands for any changed files, for example:

- `deno check supabase/functions/chat/tools/create-recipe.ts`
- `deno check supabase/functions/chat/tools/upload-image.ts`
- `deno check supabase/functions/chat/tools/get-recipe-detail.ts`
- `deno check supabase/functions/chat/flows/search-flow.ts`
- `deno check supabase/functions/chat/flows/create-flow.ts`

## 7.2 Manual smoke checklist by journey

Use these tests as slices land:

1. Search for “quick pasta with tomato”
2. Search for “vegetarian dinner under 30 minutes”
3. Ask “what are the ingredients?” while on a recipe detail page
4. Paste a text recipe and ask to save it
5. Upload one recipe screenshot and ask to create a recipe
6. Upload two images: one recipe screenshot + one plated dish cover image
7. Ask a general cooking question like “how do I thicken a sauce?”

## 7.3 Regression focus

Specifically verify:

- no cross-request contamination
- search results still render in the current recipe-card component
- create flow still works with existing tool-part rendering
- transport remains compatible with Angular `Chat` / `DefaultChatTransport`

---

## 8. Risks and mitigation

### Risk 1 — search success output is still awkward to control

**Mitigation:**

- start with narrow flow-specific handling
- if needed, let Slice 4 switch from stream sanitization to structured execution

### Risk 2 — routing mistakes send requests to the wrong flow

**Mitigation:**

- use heuristics-first routing with conservative fallbacks
- log routed intent
- fall back to `chat` when uncertain

### Risk 3 — category resolution becomes too fuzzy

**Mitigation:**

- allow unresolved categories to be omitted in Slice 5
- only ask for clarification when ambiguity is real

### Risk 4 — image classification is inconsistent

**Mitigation:**

- keep the classification output schema simple
- support “no cover image detected” as a valid result in Slice 7

---

## 9. Definition of done

The refactor is done when all of the following are true:

- request-scoped state has replaced module-level mutable state
- the edge function no longer depends on a global agent with stale tool context
- `search`, `create`, `detail`, and `chat` are routed intentionally
- category resolution is no longer the model’s burden in the normal create flow
- image handling uses a structured backend workflow
- successful search and create flows do not rely solely on prompt wording to avoid extra text
- the Angular chat client still works with the existing Vercel AI SDK-compatible transport
- build checks and smoke tests pass

---

## 10. Recommended first coding slice

Start with **Slice 1 — Safe request-scoped runtime with no product behavior change**.

Why this first:

- it fixes correctness and safety immediately
- it reduces the risk of every later slice
- it does not force a full orchestration rewrite in the first PR

After Slice 1 is stable, the next best slice is **Slice 2 — Explicit recipe-detail flow**, because it is the smallest clear end-to-end user journey.