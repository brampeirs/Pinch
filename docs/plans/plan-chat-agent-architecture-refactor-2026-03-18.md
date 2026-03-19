# Plan: Chat Agent Architecture Refactor

**Date:** 2026-03-18  
**Scope:** Design plan only. No implementation steps yet.

---

## 1. Why this refactor is needed

The current chat function works, but too much product logic lives inside one large instruction prompt. That makes the system fragile when new tools or UI flows are added.

Main issues in the current design:

1. **Workflow logic is prompt-driven**
   - Search should render UI-only results, but the model must be instructed not to speak.
   - Recipe creation with images requires a multi-step workflow described in natural language.
   - Category selection depends on the model calling an extra tool and mapping names to UUIDs.

2. **Request state leaks through module-level state**
   - `availableImages` and `currentContextRecipeId` are stored outside request scope.
   - `recipeAgent` is cached globally.
   - This can cause cross-request contamination.

3. **The backend does not strongly separate response modes**
   - Some interactions should produce conversational text.
   - Some interactions should produce UI-only tool/data output.
   - Today this distinction is mostly enforced by prompt wording.

4. **Business rules are hard to evolve safely**
   - Adding new flows increases prompt complexity.
   - The agent is acting as both interpreter and workflow engine.

---

## 2. Design goals

The refactor should:

- Keep compatibility with the **Vercel AI SDK UI message protocol** used by `useChat` / `@ai-sdk/angular` `Chat`.
- Keep the **AI Gateway** as the model access layer.
- Preserve streaming UX.
- Move orchestration and business rules into backend code.
- Keep the model responsible for interpretation, extraction, and classification.
- Make UI-only outcomes enforceable by code rather than by prompt instructions.
- Eliminate module-level mutable request context.

---

## 3. Non-goals

This phase does **not** aim to:

- Redesign the visual chat UI.
- Replace the Vercel AI SDK transport model.
- Remove tool rendering from the UI immediately if it still serves the current product.
- Finalize low-level implementation details for every helper or schema.

---

## 4. Constraints that must remain true

### AI Gateway

- The main model should continue to run through **AI Gateway**.
- Model selection/configuration should become more centralized so routing/extraction steps do not scatter provider details across files.
- If additional structured extraction/classification calls are introduced, they should also use the same gateway abstraction where practical.

### Vercel AI SDK / `useChat` message contract

The frontend currently uses `@ai-sdk/angular` `Chat` + `DefaultChatTransport`, which follows the same transport contract as `useChat`.

The backend contract should continue to look like:

- **Request body:** `{ messages: UIMessage[], ...extraFields }`
- **Response:** `UIMessageStreamResponse`

This means the refactor should preserve:

- `messages` as the canonical conversation payload
- `parts`-based rendering on the client
- support for `body` extras such as `contextRecipeId`
- streaming responses compatible with the current chat client

---

## 5. Recommended architecture

### Core principle

Use the model as a **semantic interpreter**, not as the primary workflow engine.

Split the system into four concerns:

1. **Transport layer**
   - Receives `UIMessage[]` and request-scoped extras.
   - Returns a `UIMessageStreamResponse`.

2. **Intent/routing layer**
   - Decides whether the request is mainly:
     - `search`
     - `create`
     - `detail`
     - `chat`
     - `clarification`

3. **Deterministic orchestration layer**
   - Runs the correct backend flow for that intent.
   - Enforces whether the response is **UI-only** or **conversational**.

4. **Tool/data execution layer**
   - Queries the database, uploads images, creates recipes, fetches details, etc.

---

## 6. Target request flow

### A. Search flow

1. Interpret the user request into structured search parameters.
2. Call recipe search.
3. Return a streamed assistant message that contains **search UI output only**.
4. Do not depend on the model to remember “say nothing after the tool call”.

**Desired product rule:** if search results are found, the backend guarantees there is no extra assistant prose unless explicitly desired.

### B. Create recipe flow

1. Gather request-scoped text + uploaded images.
2. Classify images into:
   - `recipe-source`
   - `cover-photo`
   - `irrelevant/unknown`
3. Extract a structured recipe draft from text and recipe-source images.
4. Resolve category internally.
5. Upload the cover image if one exists.
6. Create the recipe.
7. Return a streamed assistant message that contains **creation UI output only**.

### C. Recipe detail flow

1. Use explicit `recipeId` if present.
2. Otherwise use request-scoped `contextRecipeId`.
3. Fetch recipe details.
4. Return either:
   - conversational assistant text, or
   - structured UI output if you later choose to support a detail card/data part.

### D. General cooking chat flow

1. Use the conversational model path.
2. Allow normal assistant text.
3. Use tools only when they add factual grounding.

---

## 7. Changes by layer

### 7.1 Frontend transport and message model

Keep the current Vercel AI SDK-compatible transport model.

Planned direction:

- Continue sending `messages` as `UIMessage[]`.
- Continue sending request-scoped extras using transport `body` fields.
- Treat `contextRecipeId` and future request metadata as **transport/body concerns**, not model memory concerns.
- Make the client resilient to assistant messages that contain only tool/data parts and no text part.

Potential additional request metadata later:

- `contextRecipeId`
- `visibleRecipeIds`
- `screenContext` (e.g. `recipe-detail`, `search-results`, `home`)
- `clientCapabilities` (e.g. supports recipe cards, supports transient notifications)

### 7.2 Chat edge function

Refactor `supabase/functions/chat/index.ts` into a request-scoped orchestrator.

Planned changes:

- Stop using a module-level singleton agent for request-specific behavior.
- Stop storing images or recipe context in module scope.
- Parse request body into:
  - `messages`
  - request-scoped context
  - image attachments from the latest user message
- Route the request into a specific handling mode.
- Use the correct model/tool strategy per mode.

### 7.3 Prompt strategy

Shrink the main system prompt substantially.

The prompt should focus on:

- persona/tone
- safe conversational behavior
- high-level domain knowledge

The prompt should **not** remain responsible for:

- “speak vs do not speak” response mode enforcement
- multi-step create workflow control
- category UUID lookup workflow
- request-scoped state handling

### 7.4 Tools

#### `findRecipe`
- Keep, but treat it as a backend capability used by the search flow.
- The server should decide whether the final assistant message includes text.

#### `createRecipe`
- Change responsibility so category resolution can happen inside the backend flow or inside the tool.
- Prefer accepting a semantic category input (`name` or `slug`) and resolving to UUID server-side.

#### `uploadImage`
- Keep as an infrastructure operation.
- Do not rely on module-scoped available image state.
- Make the image source list request-scoped.

#### `getCategories`
- Keep only as an optional user-facing informational tool.
- Remove it from the normal recipe-creation dependency chain.

#### `getRecipeDetail`
- Keep.
- Make request context explicit instead of relying on module-level fallback state.

### 7.5 UI output strategy

There are two valid options:

#### Option 1 — Keep tool parts as the main UI contract (lowest migration risk)
- Preserve current `tool-findRecipe`, `tool-createRecipe`, etc. rendering.
- Add backend orchestration so these tool parts appear without unwanted assistant prose.

#### Option 2 — Introduce explicit typed data parts (cleaner long-term)
- Use Vercel AI SDK streaming data parts for app-specific UI payloads.
- Examples:
  - `data-recipe-search-results`
  - `data-recipe-created`
  - `data-recipe-detail`
  - transient notifications for upload/classification progress
- This decouples UI rendering from internal tool names.

**Recommendation:** start with **Option 1** for the refactor, then move to **Option 2** only if you want a cleaner public UI contract later.

---

## 8. Request-scoped state model

All state needed for one chat turn should be passed through request-scoped structures, not globals.

Required request-scoped context:

- `messages`
- `contextRecipeId`
- extracted image attachments
- optionally resolved visible recipe context from the client

This eliminates cross-request leakage and makes the edge function safe under concurrency.

---

## 9. Category handling plan

Current pain point: the model does not truly know the available categories, but is expected to pick one and then fetch its UUID.

Target design:

- The create flow accepts a semantic category suggestion.
- The backend resolves it against the real category list.
- If there is no clear match:
  - leave category empty, or
  - ask a clarification question, depending on product choice.

Result: category lookup becomes backend logic, not an agent choreography problem.

---

## 10. Image handling plan

Current pain point: image classification and sequencing are described in prompt prose.

Target design:

- Treat image classification as a structured preprocessing step in the create flow.
- The model returns a structured classification result.
- The backend then deterministically decides:
  - which images to parse as recipe source
  - which single image, if any, to upload as cover

Result: the model still performs perception/classification, but code owns the workflow.

---

## 11. AI Gateway considerations

The refactor should preserve AI Gateway as the boundary for model access.

Recommended principles:

- Centralize model creation/configuration in one place.
- Define which tasks use which model profile:
  - conversational response
  - structured intent routing
  - image classification / extraction
- Avoid spreading provider/model strings across multiple tools and flows.
- Keep room for future model swaps without changing the transport or UI contract.

---

## 12. Vercel AI SDK compatibility considerations

The refactor should remain aligned with AI SDK UI / `useChat` conventions:

- Keep `UIMessage[]` as the incoming payload format.
- Continue using `DefaultChatTransport` body extensions for app context.
- Continue returning a streamed UI message response.
- Support assistant messages that contain:
  - only tool parts
  - only text parts
  - mixed text + tool/data parts
- Prefer explicit, typed app-level message/data parts over prompt conventions when the UI contract matters.

Important design principle:

> The frontend should not need to infer business intent from free-form assistant text when the backend already knows the interaction mode.

---

## 13. Proposed rollout order

### Phase 1 — Stabilize the current architecture

- Remove module-level request state.
- Make tools/context request-scoped.
- Stop relying on the cached singleton agent for request-specific state.
- Reduce the prompt to a smaller, safer version.

### Phase 2 — Add intent-based orchestration

- Introduce request routing (`search`, `create`, `detail`, `chat`).
- Enforce UI-only outcomes in backend code for search/create.
- Move category resolution out of the agent workflow.

### Phase 3 — Improve structured UI contracts

- Decide whether to keep tool-part rendering or introduce typed data parts.
- If needed, add transient progress events for upload/classification/search states.

### Phase 4 — Hardening and observability

- Add structured logging per request mode.
- Track tool usage and fallback/clarification paths.
- Add regression tests for request isolation and response mode behavior.

---

## 14. Success criteria

This refactor is successful when:

- Search results can be returned without brittle “do not say anything” prompt rules.
- Recipe creation with images no longer relies on prompt-only workflow choreography.
- Category UUID lookup is no longer a model burden during normal creation.
- `getRecipeDetail` works with explicit request context and no global fallback state.
- The edge function remains compatible with the current Vercel AI SDK-style chat transport.
- The system is safer to extend with future tools and UI interactions.

---

## 15. Open questions for the implementation plan

These should be resolved before implementation starts:

1. Should search/create continue to render via **tool parts**, or should we move to **typed data parts** now?
2. Should recipe detail remain conversational text first, or also become a structured UI payload?
3. Should category mismatch default to **no category** or to a **clarification question**?
4. Should image classification and recipe extraction use the same model profile or separate ones?
5. Should embeddings remain as currently implemented, or also be routed through a centralized provider configuration layer?

---

## 16. Recommended next document

After approval of this architecture plan, create a separate **implementation plan** that specifies:

- exact file changes
- request/response shapes
- tool signature changes
- frontend rendering adjustments
- migration order
- validation and regression tests