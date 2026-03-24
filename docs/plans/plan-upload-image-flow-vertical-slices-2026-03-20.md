# Plan: Upload Image Flow Vertical Slices

**Date:** 2026-03-20  
**Scope:** UX/UI and implementation plan for a dedicated image-to-recipe creation flow.

---

## 1. Goal

Design and implement a focused **upload image flow** that lets users create a recipe from one or more images, with a strong UX first and backend integration added in vertical slices.

This should feel like a dedicated creation experience, not like a chat-first workflow, while still reusing proven parts of the existing chat upload and AI creation logic.

---

## 2. Product requirements

- User must select at least **1 image**.
- **HEIC/HEIF is not supported**.
- User can select **multiple images in one go**.
- User can select images, then reopen the file picker and **add more images**.
- User can **remove** an image.
- User sees a **preview grid** with thumbnails shown in a consistent size.
- Images should be **uploaded immediately** to storage when selected.
- User should see an **appealing loading state** while recipe creation runs.
- User should be **redirected to the recipe detail page** after successful creation.
- System should show a **clear error/notification** if creation fails.

---

## 3. Recommended UX/UI

### Entry point

From `/recipes/new`, offer two clear choices:

- **Upload photos**
- **Enter manually**

This fits the existing route structure and keeps the image flow purpose-built.

### Main page layout

A dedicated page such as **Create recipe from photos** with:

- short helper text
- upload area with primary CTA
- selected image grid
- optional note/input field later
- primary **Create recipe** button

### Upload area

- Primary button: **Select images**
- Secondary hint: drag and drop can be added later
- Helper text: `JPG, PNG, WebP · HEIC not supported`

### Selected images grid

Each tile should show:

- image preview
- upload status
- remove action
- retry action if upload failed

All thumbnails should use the same aspect ratio and size for a tidy layout.

### Creation CTA

- Disabled until at least **1 uploaded image** is ready
- Primary CTA: **Create recipe**
- Secondary CTA: **Start over** or **Cancel**

---

## 4. Answers to open product questions

### 4.1 Should there be a dedicated cover image slot?

**Recommendation: no dedicated cover image slot in v1.**

Reasoning:

- Backend logic already exists to determine the best cover image.
- Asking the user to choose a cover adds friction.
- Many users will not know or care which image should become the cover.

Preferred v1 behavior:

- show all images equally
- add helper copy like: **Pinch will automatically choose the best cover photo**

Possible v2 enhancement:

- allow optional manual override with a **Set as cover** action

### 4.2 Should we show a streaming response like chat?

**Recommendation: not as token-streamed chat text in v1.**

Better v1 UX is a **stage-based progress experience** such as:

- Uploading images
- Reading recipe
- Choosing cover image
- Saving recipe
- Redirecting

Later, streaming can be added for status/progress events rather than conversational text.

### 4.3 How should backend logic be handled?

**Recommendation: create a dedicated edge function** for this image-to-recipe flow.

Why:

- different UX than chat
- different request/response shape
- different success behavior (redirect rather than render chat parts)
- easier to reason about retries and failures

However, the backend should **reuse shared logic** from the current chat creation flow where possible:

- category selection
- cover image selection
- recipe creation
- prompt/orchestration patterns for image-based extraction

---

## 5. Vertical slices

## Slice 1 — UI-only prototype

### Goal

Validate the user flow and page design **without real backend creation**.

### Scope

- dedicated page layout
- select one or many images
- reopen picker to add more
- remove image
- consistent preview grid
- reject HEIC in UI
- fake create flow with mocked progress state
- fake success state

### Acceptance criteria

- user can add images multiple times
- user can remove any image
- HEIC shows immediate validation feedback
- page feels good enough to validate UX with stakeholders
- no backend recipe creation dependency yet

### Why first

This is the fastest way to validate the experience before committing to backend details.

---

## Slice 2 — Real upload to Supabase storage

### Goal

Make image handling real while recipe creation remains mocked.

### Scope

Reuse the chat upload pattern:

- upload immediately on selection
- use signed upload URLs
- show per-image progress
- support retry on failed upload
- preserve previews after upload
- keep uploaded public URLs in page state

### Acceptance criteria

- uploaded images go to temporary storage immediately
- create button enables only when at least one upload is completed
- remove removes image from payload state
- retry works for failed uploads

### Notes

- Keep image order stable.
- Continue to block HEIC/HEIF explicitly.
- Creation can still be mocked in this slice.

---

## Slice 3 — Backend MVP (non-streaming)

### Goal

Create a real recipe from uploaded images end-to-end.

### Scope

Add a dedicated edge function that accepts:

- uploaded image URLs
- media types
- optional user note/context

Backend responsibilities:

- determine category
- determine cover image
- extract recipe content from images
- create recipe
- return success/failure plus created recipe id

### Recommendation

For the first end-to-end version, return a **simple JSON response** instead of a streamed response.

### Acceptance criteria

- clicking **Create recipe** creates a real recipe
- success redirects to `/recipes/:id`
- failure stays on the page and shows an error
- uploaded image state stays available for retry

---

## Slice 4 — Streamed progress UX

### Goal

Make recipe creation feel alive and trustworthy.

### Scope

Upgrade the backend to emit progress events such as:

- `images-received`
- `analyzing-images`
- `extracting-recipe`
- `choosing-cover`
- `saving-recipe`
- `recipe-created`

Frontend should render this as a **progress panel**, not as chat text.

### Acceptance criteria

- user sees real-time creation progress
- success transitions cleanly into redirect
- failure transitions cleanly into retry state

---

## Slice 5 — Polish, notifications, and resilience

### Goal

Handle failure cases and improve perceived quality.

### Scope

- clear error notification on creation failure
- retry without forcing re-upload
- mobile polish
- accessibility improvements
- abandoned temp-upload cleanup strategy

### Note on notifications

If the app does not yet have a global toast system, start with an **inline error banner** near the CTA. A toast system can be added later if needed.

### Acceptance criteria

- failure messaging is obvious
- retry path is simple
- mobile flow feels good
- temp file cleanup strategy is defined

---

## 6. Recommended implementation order

### Phase 1 — Validate UX quickly

1. Slice 1
2. Slice 2

### Phase 2 — Ship usable feature

3. Slice 3

### Phase 3 — Premium UX and resilience

4. Slice 4
5. Slice 5

---

## 7. Additional requirements to define early

### File constraints

- maximum number of images
- maximum file size per image
- exact accepted formats (`jpg`, `jpeg`, `png`, `webp`)

### Ordering

- preserve user image order in payloads
- do not reorder silently on the client

### Partial failure behavior

- if some uploads fail, user can continue as long as at least one valid image remains

### Retry behavior

- if recipe creation fails, do not force re-upload

### Temp file lifecycle

- define cleanup for unused temporary uploads

### Accessibility

- keyboard-accessible remove buttons
- screen-reader labels on image tiles and status
- clear disabled state for create CTA

### Mobile UX

- preview grid works well on small screens
- consider sticky footer CTA

---

## 8. Strong recommendations

- Do **not** add a dedicated cover-image slot in v1.
- Do **not** start with chat-style token streaming.
- Do build this as a **dedicated page**, not a chat transcript.
- Do reuse the **existing immediate upload pattern**.
- Do create a **separate edge function** for the flow while reusing shared backend internals.

---

## 9. Deliverables by slice

- **Slice 1:** clickable UI prototype with mocked happy path
- **Slice 2:** real image uploads with previews, retry, and validation
- **Slice 3:** real recipe creation and redirect
- **Slice 4:** real-time streamed progress
- **Slice 5:** polish, resilience, cleanup, and notification improvements