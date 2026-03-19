# Plan: Chat Routing Refactor with Vertical Slices

**Date:** 2026-03-19
**Status:** ✅ Complete (all 5 slices implemented)
**Audience:** An implementation agent with no prior conversation context

## Summary of delivery

All 5 slices have been implemented, tested, and deployed:

| Slice | Delivered |
|---|---|
| 1 — Router + Search | AI router (`route-intent.ts`) + search flow with `findRecipe` tool |
| 2 — Search hardening | Zero-prose policy, `stepCountIs(3)`, fallback text, 11 tests |
| 3 — Detail | Follow-up after search, recipe resolution from history, dynamic prompt |
| 4 — Create (text) | `getCategories` + `createRecipe` tools, category selection |
| 5 — Create (images) | Image classification (recipe-source vs cover-photo), `uploadImage` tool |

Post-refactor fixes: flaky emoji test (fast-path heuristic), `null` vs `undefined` in Zod schemas, `categoryName` in tool output, English backend messages.

## 1. Problem statement

The current chat backend in `supabase/functions/chat/index.ts` relies on one large prompt plus a general `ToolLoopAgent` for multiple product journeys:

- recipe search
- recipe detail Q&A
- recipe creation
- general cooking chat

This worked initially, but it is becoming hard to scale. Workflow behavior is encoded mostly in prompt instructions instead of backend control flow.

## 2. Current code context

Relevant files today:

- `supabase/functions/chat/index.ts`
- `supabase/functions/chat/tools/find-recipe.ts`
- `supabase/functions/chat/tools/get-recipe-detail.ts`
- `supabase/functions/chat/tools/create-recipe.ts`
- `supabase/functions/chat/tools/upload-image.ts`
- `supabase/functions/chat/tools/get-categories.ts`
- `supabase/functions/chat/flows/detail-flow.ts`
- `supabase/functions/chat/prompts/detail-prompt.ts`

Important observations from the current implementation:

1. `index.ts` still contains a large `AGENT_INSTRUCTIONS` block covering all use cases.
2. `findRecipe` is already a good low-level capability and returns structured recipe-card data.
3. `getRecipeDetail` already supports `contextRecipeId` fallback.
4. `detail-flow.ts` appears to be in an incomplete transition state and should not be treated as the target architecture.
5. The frontend uses the Vercel AI SDK-compatible Angular chat client and expects streaming `UIMessage` responses.

## 3. Architectural decision

Adopt a **top-level AI router** followed by **separate backend flows**.

Pattern choice:

- **Routing** at the top level: classify the user request into one intent.
- **Sequential flow** for `search` and `detail`.
- **Sequential flow first, possible orchestrator later** for `create`.
- Keep `generalChat` as a small conversational fallback path.

This means the model is used as a **semantic classifier/interpreter**, not as the main workflow engine.

## 4. Target intent model

The router should classify requests into exactly one of:

- `search`
- `detail`
- `create`
- `generalChat`

Recommended router output schema:

- `reasoning: string`
- `type: 'search' | 'detail' | 'create' | 'generalChat'`

The router should only classify. It should not call business tools.

## 5. Target high-level request flow

1. Parse request body and request-scoped context.
2. Extract the latest user message and any attached images.
3. Run the top-level AI router.
4. `switch (classification.type)` into a dedicated flow.
5. Each flow gets only the tools and prompt/context it actually needs.

## 6. Hard constraints

The implementation agent must preserve these constraints unless a later spec says otherwise:

1. Keep the transport compatible with the current Angular chat client.
2. Keep streaming responses.
3. Do not redesign the frontend UI as part of this refactor.
4. Prefer small, shippable slices over large rewrites.
5. If necessary, temporarily shrink scope by disabling unfinished routes rather than keeping a fragile mega-agent.

## 7. Vertical slice strategy

## Slice 1 — Router skeleton + search only

### Goal

Introduce the top-level router and get **search** working end-to-end through the new architecture before touching other journeys.

### Scope

- Add a router helper, e.g. `supabase/functions/chat/_lib/route-intent.ts`
- Add `supabase/functions/chat/flows/search-flow.ts`
- Refactor `index.ts` so all requests first pass through the router
- Implement only the `search` branch fully
- Temporarily make `detail` and `create` return a short explicit fallback such as “temporarily unavailable during refactor” or route them to `generalChat` without tools

### Acceptance criteria

- Search requests still render recipe cards in the UI
- Search no longer depends on the mega-agent owning all tools
- The code path for search is isolated and easy to test
- Non-search requests fail safely and predictably

### Manual test cases

- “quick pasta with tomato”
- “vegetarian dinner under 30 minutes”
- “ik zoek een spicy soep”

### Validation

- Verify the router picks `search` for these prompts
- Verify `findRecipe` still returns UI-rendered recipe cards
- Verify no regression in chat transport

## Slice 2 — Search hardening

### Goal

Make the search slice production-safe and deterministic enough before expanding scope.

### Scope

- Tighten the search prompt/instructions
- Limit tools available in search flow to only what search needs
- Ensure successful search does not produce stray assistant prose if the product requires UI-only results
- Add focused tests for the router and/or search flow if practical

### Acceptance criteria

- Search behaves consistently across phrasing variants
- Successful results follow the intended UI-only or minimal-text policy
- The search slice can be considered stable enough to build on

## Slice 3 — Detail slice

### Goal

Implement `detail` as a **simple sequential flow**, not as a subagent-heavy workflow.

### Scope

- Add or replace `supabase/functions/chat/flows/detail-flow.ts`
- Resolve recipe ID by precedence:
  1. explicit recipe reference from the request/history
  2. `contextRecipeId`
  3. clarification if neither exists
- Reuse `getRecipeDetail` as the data capability
- Keep tools limited to what detail needs

### Acceptance criteria

- Questions like “what are the ingredients?” work from a recipe page
- Detail answers use the correct current recipe
- No stale context from previous requests is used

### Manual test cases

- “what are the ingredients?” from a recipe detail screen
- “how long does this take?” from a recipe detail screen
- “tell me more about the first one” after a search result flow, if history-based resolution is implemented in this slice

## Slice 4 — Create slice, text only

### Goal

Bring back recipe creation in the simplest reliable form: text-only create.

### Scope

- Add `supabase/functions/chat/flows/create-flow.ts`
- Support creation from typed recipe content only
- Delay image handling for the next slice
- If category resolution is needed, do it in backend flow code rather than via prompt-heavy orchestration

### Acceptance criteria

- A user can paste/write a recipe and save it successfully
- The resulting recipe card/UI output still renders correctly

## Slice 5 — Create slice, images

### Goal

Add image-aware creation after the basic create path is stable.

### Scope

- Support request-scoped image extraction
- Classify images as recipe-source vs cover-photo
- Upload only the chosen cover image
- Merge extracted recipe content with uploaded image URL before `createRecipe`

### Acceptance criteria

- Multi-image create works reliably for the supported cases
- Image state is request-scoped only

## 8. Recommended file targets

Expected files to create or refactor incrementally:

- `supabase/functions/chat/index.ts`
- `supabase/functions/chat/_lib/route-intent.ts`
- `supabase/functions/chat/flows/search-flow.ts`
- `supabase/functions/chat/flows/detail-flow.ts`
- `supabase/functions/chat/flows/create-flow.ts`
- `supabase/functions/chat/flows/general-chat-flow.ts`
- optional prompt files under `supabase/functions/chat/prompts/`

## 9. Implementation rule of thumb

If a rule can be enforced in backend code, enforce it in backend code. Do not keep adding prompt instructions to force simple control flow.

## 10. Recommended next action

Execute **Slice 1 only**:

1. add the router
2. wire `index.ts` to a `switch`
3. implement only `search`
4. temporarily shrink/disable the other branches
5. test search thoroughly before moving to Slice 2