# Pinch Architecture - AI Context Document

## PURPOSE
This document provides a structured overview of the Pinch recipe app architecture for AI assistants.

---

## CURRENT SYSTEM OVERVIEW

### Tech Stack
- **Frontend**: Angular 19 + @ai-sdk/angular
- **Backend**: Supabase Edge Functions (Deno)
- **AI**: AI SDK v6 (`npm:ai`) + AI Gateway (OpenAI gpt-4o for flows, gpt-4o-mini for router)
- **Database**: PostgreSQL + pgvector for semantic search
- **Storage**: Supabase Storage (recipe images: `chat-uploads/` → `recipes/`)

---

## ARCHITECTURE: ROUTER + VERTICAL FLOWS

The chat backend uses a **top-level AI router** that classifies user intent, followed by **separate streamText flows** — each with only the tools it needs.

```
Frontend (UIMessage[])
    ↓
index.ts
    ├── Extract images from last user message
    ├── Extract search recipes from conversation history
    ├── routeIntent() → classify into search | detail | create | generalChat
    ├── convertToModelMessages()
    └── switch (intent) → run dedicated flow
        ↓
Flow returns streamText result
    ↓
result.toUIMessageStreamResponse() → SSE stream → Frontend
```

### Router (`_lib/route-intent.ts`)
- Uses `gpt-4o-mini` with structured output (Zod schema)
- Fast-path heuristics (no LLM call): images → `create`, emoji-only → `search`
- Receives context: `hasContextRecipeId`, `hasImages`, `searchRecipes[]`

---

## FLOWS

### Search Flow (`flows/search-flow.ts`)
| Property | Value |
|---|---|
| Model | gpt-4o |
| Tools | `findRecipe` |
| Steps | `stepCountIs(3)` |
| Behavior | Single `findRecipe` call, zero assistant text on success, fallback message on zero results |

### Detail Flow (`flows/detail-flow.ts`)
| Property | Value |
|---|---|
| Model | gpt-4o |
| Tools | `getRecipeDetail` |
| Steps | `stepCountIs(3)` |
| Behavior | Dynamic prompt with `contextRecipeId` and/or search history recipes. Model resolves which recipe to fetch. |

### Create Flow (`flows/create-flow.ts`)
| Property | Value |
|---|---|
| Model | gpt-4o |
| Tools | `getCategories` + `createRecipe` (+ `uploadImage` when images present) |
| Steps | `stepCountIs(5)` text-only, `stepCountIs(7)` with images |
| Behavior | Extract recipe from text/images, resolve category, optionally upload cover photo, create recipe |

### General Chat Flow (`flows/general-chat-flow.ts`)
| Property | Value |
|---|---|
| Model | gpt-4o |
| Tools | none |
| Steps | no limit |
| Behavior | General cooking Q&A, tips, advice |

---

## TOOLS

### findRecipe (`tools/find-recipe.ts`)
- **Input**: `searchQuery`, optional `category`, `tags`, `maxTime`, `matchCount`
- **Action**: Generate embedding → `search_recipes` RPC (pgvector)
- **Output**: `{ success, message, recipes[] }`

### getRecipeDetail (`tools/get-recipe-detail.ts`)
- **Input**: `recipeId` (UUID, or empty string to use contextRecipeId)
- **Action**: Fetch recipe with ingredients and steps from database
- **Output**: Full recipe data

### getCategories (`tools/get-categories.ts`)
- **Input**: `_reason` (string, for logging)
- **Action**: Fetch all categories from database
- **Output**: `{ success, categories[] }` with id, name, slug, emoji

### createRecipe (`tools/create-recipe.ts`)
- **Input**: `recipe` (title, description, category_id, image_url, prep/cook time, servings), `ingredients[]`, `steps[]`
- **Action**: Call `create-recipe` edge function → `create_recipe` RPC → trigger `embed-recipe`
- **Output**: `{ success, recipe: { id, title, categoryName, ... } }`

### uploadImage (`tools/upload-image.ts`)
- **Input**: `imageIndex`, `purpose` (recipe-cover | recipe-step)
- **Action**: Copy image from `chat-uploads/` to `recipes/` in Supabase Storage
- **Output**: `{ success, url }` — permanent public URL

---

## CLIENT (`src/app/components/ai-chat/ai-chat.ts`)

- Uses `@ai-sdk/angular` `Chat` class with `DefaultChatTransport`
- Sends `{ messages: UIMessage[], contextRecipeId? }` to `/functions/v1/chat`
- Image upload: client uploads to `chat-uploads/` via signed URL, sends public URL as `file` part
- Renders tool outputs as recipe cards (`ChatRecipeCard` component)

---

## CONTEXT EXTRACTION (`_lib/extract-search-recipes.ts`)

Scans `UIMessage[]` history for `tool-findRecipe` parts with `state: 'output-available'`. Extracts `{ id, title }[]` for use by the router and detail flow. This enables follow-up questions after a search (e.g., "how do I make the first one?").

---

## TESTS

Run with: `npm run test:chat`

14 integration tests covering:
- Search: 7 tests (various languages, emoji, filters, zero-prose policy)
- General chat: 3 tests (cooking tips, greetings)
- Detail: 2 tests (follow-up after search, contextRecipeId)
- Create: 1 test (text-only recipe creation)

