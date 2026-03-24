# Plan: Step Sections and Numbering Vertical Slices

**Date:** 2026-03-24  
**Scope:** Improve recipe instruction UX and extraction quality for step numbering and step sections.

---

## 1. Goal

Address two related but distinct issues in recipe instructions:

1. **Frontend numbering** should restart per visible step section on the recipe detail page.
2. **Step sections** should not be invented too aggressively by AI/parsing flows, because that can break the logical execution order of a recipe.

The main product principle is:

> Users should be able to execute a recipe from top to bottom without being confused by section grouping.

---

## 2. Product decisions

### Decision A — FE numbering is section-local

When the UI renders steps grouped into sections, the visible badge number should restart inside each section.

Examples:

- Main section: `1, 2, 3`
- `Voor de dressing`: `1`

The stored `step_number` in the database may remain global. This is a **display-only** rule.

### Decision B — Step sections should be conservative

For **steps**, `section_name` should only be used when the source material clearly contains an explicit heading.

Good examples:

- `For the dressing`
- `Sauce`
- `Afwerking`

Bad behavior:

- inventing a section because a few consecutive steps seem related
- splitting out a subsection that is later referenced earlier in the flow
- creating a visually separate section that makes the recipe read out of order

### Decision C — When in doubt, preserve linear flow

If there is any ambiguity, prefer:

- original step order
- `section_name = null`

This is stricter for **steps** than for **ingredients**, because step grouping affects execution order.

---

## 3. Current code areas involved

Relevant files today:

- `src/app/pages/recipe-detail/recipe-detail.html`
- `src/app/pages/recipe-detail/recipe-detail.ts`
- `src/app/pages/add-recipe/add-recipe.ts`
- `src/app/pages/add-recipe/add-recipe.html`
- `supabase/functions/parse-recipe/index.ts`
- `supabase/functions/chat/flows/create-flow.ts`
- `supabase/functions/create-recipe-from-images/index.ts`
- `supabase/functions/chat/tools/create-recipe.ts`
- `supabase/functions/_shared/recipe-schemas.ts`

Observations:

- the detail page groups steps by `section_name`
- the detail page currently displays the stored global `step.step`
- manual pasted-step parsing uses `parse-recipe`
- AI recipe creation from chat and images can also provide `section_name`

---

## 4. Vertical slice roadmap

## Slice 1 — FE-only numbering reset on recipe detail

### Goal

Make the visible instruction numbering restart per rendered section, without changing stored data.

### Scope

- update `recipe-detail.html` so the badge uses the section-local loop index
- keep database `step_number` unchanged
- keep grouping behavior unchanged for now

### Acceptance criteria

- a section with 3 steps renders `1, 2, 3`
- the next section restarts at `1`
- no backend or schema changes are required

### Validation

- inspect recipe detail page with at least one multi-section recipe
- run Angular diagnostics/build check for touched frontend files

### Risk

- low risk; display-only change

---

## Slice 2 — Harden manual pasted-step parsing

### Goal

Stop the pasted-text parser from inventing step sections unless the source text explicitly contains a heading.

### Scope

- tighten `STEPS_PROMPT` in `supabase/functions/parse-recipe/index.ts`
- explicitly instruct the model to preserve headings only when clearly present in the source
- explicitly instruct the model not to infer new step sections from ingredient groupings or semantic guesses
- add examples for when `section_name` must be `null`

### Acceptance criteria

- pasted plain linear instructions without headings produce steps with `section_name: null`
- pasted instructions with explicit headings preserve those headings
- the parser does not create a separate section just because a sub-preparation exists conceptually

### Validation

- targeted function check for `supabase/functions/parse-recipe/index.ts`
- manual parser smoke tests with:
  - plain linear recipe text
  - recipe text with explicit headings
  - recipe text mentioning a subcomponent without a heading

### Risk

- medium risk; stricter prompting may reduce some useful grouping, but should improve flow consistency

---

## Slice 3 — Harden chat-based recipe creation

### Goal

Apply the same conservative step-section rule to recipes created from text through chat.

### Scope

- update `supabase/functions/chat/flows/create-flow.ts`
- clarify in prompts that step sections must only be used when explicit headings are present in the user-provided recipe
- update any nearby schema/tool descriptions if needed so the contract is consistent

### Acceptance criteria

- chat-created recipes without explicit step headings save steps with `section_name: null`
- chat-created recipes with explicit headings preserve them
- instructions remain in original order

### Validation

- targeted tests or smoke checks for the chat create flow
- verify no type/schema regressions in shared recipe contracts

### Risk

- medium risk; prompt-only behavior can still be imperfect, so keep scope small and verify with a few examples

---

## Slice 4 — Harden image-to-recipe creation

### Goal

Apply the same conservative step-section rule to recipes extracted from uploaded images.

### Scope

- update `supabase/functions/create-recipe-from-images/index.ts`
- if needed, align shared wording in `create-recipe` tool descriptions
- preserve explicit headings seen in the image text, but do not invent new step sections

### Acceptance criteria

- OCR/extracted recipes only carry step sections when the source image clearly contains them
- recipes without explicit headings remain linear in saved steps

### Validation

- targeted smoke test with an image recipe that has headings
- targeted smoke test with an image recipe that does not have headings

### Risk

- medium risk due to OCR ambiguity; prefer false negatives over false positives for sections

---

## Slice 5 — Optional safety net / normalization pass

### Goal

Add a final guard only if slices 2-4 still allow too many bad section assignments through.

### Scope

One of these, but only if needed:

- a lightweight normalization helper before saving steps
- an editor-side review affordance in manual create/edit flow
- a rule that strips suspicious step sections when source evidence is missing

### Acceptance criteria

- only pursue if real examples still fail after prompt hardening
- do not add complexity unless prompt-only hardening proves insufficient

### Validation

- based on observed failures from earlier slices

### Risk

- highest complexity slice; should remain optional

---

## 5. Recommended execution order

Recommended order:

1. **Slice 1** — immediate UX fix, very low risk
2. **Slice 2** — improve manual pasted-step parsing
3. **Slice 3** — align chat create flow
4. **Slice 4** — align image create flow
5. **Slice 5** — only if needed after real-world validation

Why this order:

- we get a user-visible improvement immediately
- we fix the narrowest extraction path before broader AI creation flows
- we keep the stricter product rule consistent across all creation entry points

---

## 6. MVP definition

The MVP is reached when:

- the recipe detail page restarts visible step numbering per section
- manual pasted-step parsing no longer invents step sections without explicit headings
- newly created recipes preserve linear step flow unless headings are clearly present in the source

Chat and image creation hardening are highly desirable, but the minimum usable improvement is:

- **Slice 1 + Slice 2**

---

## 7. Suggested next action

Execute **Slice 1 only** first.

It is the smallest, safest change and gives immediate UX improvement while we keep the extraction behavior untouched until we validate the stricter section rule.