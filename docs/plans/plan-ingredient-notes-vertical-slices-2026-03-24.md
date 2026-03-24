# Plan: Ingredient Notes Vertical Slices

**Date:** 2026-03-24  
**Scope:** Structured ingredient notes/opmerkingen for manual creation, pasted-text parsing, AI chat creation, and image-based recipe creation.

---

## 1. Goal

Add support for an optional **ingredient note** so recipes can store extra preparation/context per ingredient, for example:

- `1 onion` + note `finely chopped`
- `200 g butter` + note `room temperature`
- `2 carrots` + note `in small dice`

The note must be supported consistently across all creation flows and must be displayed back in the recipe UI.

---

## 2. Key product decision

### Recommendation

Use a dedicated nullable field on `ingredients`, named **`note`**.

### Why this is the right shape

- more structured than pushing everything into `name`
- easier to render consistently in the UI
- easier for AI flows to extract reliably
- safer for future filtering/export/editing than free-form merged ingredient names

### Explicit non-goals for this work

- no separate note field for steps in this slice plan
- no search/ranking redesign for ingredient notes in MVP
- no spec-file updates required

---

## 3. Current state in the codebase

- `create_recipe` RPC already creates recipes atomically and already supports ingredient/step `section_name`.
- Shared recipe schemas live in `supabase/functions/_shared/recipe-schemas.ts` and are reused by edge functions and chat tools.
- Manual create/edit lives in `src/app/pages/add-recipe/add-recipe.ts`.
- Recipe detail rendering already groups ingredients by section in `src/app/pages/recipe-detail/recipe-detail.ts`.
- Chat creation reuses `createCreateRecipeTool(...)`.
- Image-based creation reuses the same `createRecipe` tool through `create-recipe-from-images`.
- Edit mode is important: `updateRecipe(...)` inserts ingredients directly and must also carry the new field.

---

## 4. Data contract proposal

### Database

Add `ingredients.note text null`.

### Normalization rule

- trim whitespace
- persist empty string as `NULL`
- store plain text only

### UI rendering rule

- keep the ingredient `name` clean
- render `note` as secondary metadata for the ingredient
- in recipe detail, prefer a smaller muted second line under the ingredient name/value

### AI extraction rule

Extract preparation/context into `note` only when it is clearly not part of the ingredient identity.

Examples:

- `1 onion, finely chopped` → `name=onion`, `note=finely chopped`
- `50 g butter, melted` → `name=butter`, `note=melted`
- `Parmesan cheese` → keep as `name`, not a note

---

## 5. Vertical slices

## Slice 1 — Database contract + manual create/edit + detail display

### Goal

Ship one complete vertical slice where a user can manually add an ingredient note, save the recipe, edit it again, and see the note on the recipe detail page.

### Scope

- add migration for `ingredients.note`
- update `create_recipe` RPC to persist `note`
- update generated Supabase types
- extend shared ingredient schemas with `note`
- extend `SupabaseService.createRecipe(...)`
- extend `SupabaseService.updateRecipe(...)`
- extend `add-recipe` ingredient form state, load path, create path, and edit path
- extend recipe detail mapping/rendering to show the note

### Dependencies

- Supabase migration applied before frontend save tests
- regenerated types after schema change

### Validation

- apply schema change with Supabase CLI
- run `npm run import-supabase-types`
- manual smoke test:
  1. create recipe manually with ingredient note
  2. verify DB row contains `note`
  3. open recipe detail and verify note is shown
  4. edit recipe and verify note survives round-trip

### Risks

- edit mode may silently drop notes if update path is missed
- detail page may show awkward layout if note rendering is not designed explicitly

---

## Slice 2 — Pasted-text parsing in manual flow

### Goal

Support ingredient notes when the user pastes raw ingredient text into the manual helper/parser.

### Scope

- extend parser-side ingredient schema with `note`
- update `parse-recipe` prompt/instructions for ingredient extraction
- preserve existing `section_name` extraction
- map parsed `note` into the manual ingredient form
- add a few high-signal examples in the prompt for chopping/melting/room-temperature style notes

### Dependencies

- Slice 1 data contract must already exist

### Validation

- invoke `parse-recipe` with representative text samples
- verify output separates `name` and `note`
- verify sections still parse correctly in the same payload
- manual UI smoke test with pasted ingredient block

### Risks

- model may over-extract and move essential ingredient identity into `note`
- punctuation such as parentheses or commas may lead to inconsistent parsing

### Guardrails

- only move prep/condition/context into `note`
- keep variety/type words in `name` unless clearly extra instruction

---

## Slice 3 — AI chat creation flow

### Goal

Make sure recipes created through chat also persist structured ingredient notes.

### Scope

- extend shared tool input schema with `note`
- update `createRecipe` tool descriptions/examples to encourage structured notes
- update create-flow prompting where needed so the model prefers `note` over stuffing text into `name`
- ensure chat-created recipes render notes on detail automatically via Slice 1 UI work
- add or extend chat integration test coverage for recipe creation with ingredient notes

### Dependencies

- Slice 1 shared schema and persistence path
- preferably after Slice 2 so prompt examples can stay aligned

### Validation

- run `npm run test:chat`
- add a targeted chat create test using phrasing such as `1 onion, finely chopped`
- verify created recipe stores `ingredients.note`

### Risks

- LLM may still emit the full string in `name`
- prompt and schema examples can drift if not kept together

---

## Slice 4 — Image upload / OCR recipe creation flow

### Goal

Extract ingredient notes from uploaded recipe photos as part of the image-to-recipe flow.

### Scope

- update `create-recipe-from-images` prompt so OCR/extraction captures ingredient notes
- keep using the shared `createRecipe` tool so persistence stays centralized
- verify streamed progress UX does not need protocol changes
- smoke test with realistic image samples containing notes like `gehakt`, `gesmolten`, `op kamertemperatuur`

### Dependencies

- Slice 1 shared persistence path
- Slice 3 tool/schema updates reused here

### Validation

- deploy updated edge function(s) if required
- run an image-flow smoke test through UI or direct function invocation
- verify created recipe detail page shows extracted notes correctly

### Risks

- OCR may merge notes into ingredient names unpredictably
- section headings plus notes in the same line can confuse extraction

---

## Slice 5 — Polish, consistency, and regression hardening

### Goal

Make the feature feel coherent across the full app and reduce regression risk.

### Scope

- finalize note copy/labels in create and edit UI
- ensure empty notes are not rendered
- review mobile layout and wrapping on recipe detail
- consider whether embeddings/search should ignore or include notes later
- document final examples and QA checklist in the plan/PR description

### Dependencies

- previous slices completed

### Validation

- regression smoke across all creation flows:
  1. manual typed entry
  2. manual pasted parser
  3. AI chat creation
  4. image upload creation
- verify old recipes without notes still render cleanly

### Risks

- UI inconsistency if one flow labels the field as note and another as remark/opmerking
- regression risk in older recipes if rendering assumes the field always exists

---

## 6. Recommended implementation order

1. **Slice 1 first** because it establishes the actual storage contract and visible user value.
2. **Slice 2 second** because manual pasted parsing is the smallest AI-assisted extension.
3. **Slice 3 third** because chat already reuses shared schemas and should become mostly contract/prompt work.
4. **Slice 4 fourth** because image OCR is the noisiest extraction path and benefits from the earlier schema/prompt lessons.
5. **Slice 5 last** for consistency, QA, and follow-up polish.

---

## 7. Files likely touched per slice

- `supabase/migrations/*`
- `supabase/functions/_shared/recipe-schemas.ts`
- `supabase/functions/create-recipe/index.ts`
- `supabase/functions/parse-recipe/index.ts`
- `supabase/functions/chat/tools/create-recipe.ts`
- `supabase/functions/chat/flows/create-flow.ts`
- `supabase/functions/create-recipe-from-images/index.ts`
- `src/app/services/supabase.service.ts`
- `src/app/pages/add-recipe/add-recipe.ts`
- `src/app/pages/add-recipe/add-recipe.html`
- `src/app/pages/recipe-detail/recipe-detail.ts`
- `src/app/pages/recipe-detail/recipe-detail.html`
- `src/app/models/database.types.ts`

---

## 8. Validation commands and operational notes

### Useful commands

- `npm run import-supabase-types`
- `npm run test:chat`
- `npx supabase functions deploy create-recipe`
- `npx supabase functions deploy parse-recipe`
- `npx supabase functions deploy chat`
- `npx supabase functions deploy create-recipe-from-images`

### Notes

- Use Supabase CLI for schema verification and edge-function deployment where needed.
- Do not update spec files for this task.
- Keep the field name consistent everywhere: prefer **`note`** over mixing `comment`, `remark`, and `opmerking` in the code.

---

## 9. MVP definition

The MVP is reached when:

- manual create/edit supports ingredient notes
- recipe detail displays ingredient notes
- pasted ingredient parsing can extract notes reasonably well
- chat and image-based creation can persist notes without breaking sections

That gives one consistent ingredient-note model across all recipe creation paths without requiring a broader redesign.