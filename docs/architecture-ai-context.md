# Pinch Architecture - AI Context Document

## PURPOSE
This document provides a structured overview of the Pinch recipe app architecture for AI assistants.

---

## CURRENT SYSTEM OVERVIEW

### Tech Stack
- **Frontend**: Angular 19 + @ai-sdk/angular
- **Backend**: Supabase Edge Functions (Deno)
- **AI**: Vercel AI SDK + AI Gateway (OpenAI gpt-4o-mini)
- **Database**: PostgreSQL + pgvector for semantic search
- **Storage**: Supabase Storage (for recipe images)

---

## COMPONENT MAP

### 1. CLIENT (Angular)
```
src/app/components/ai-chat/ai-chat.ts
├── Uses: @ai-sdk/angular Chat class
├── Transport: DefaultChatTransport → POST to /functions/v1/chat
├── Sends: { messages: UIMessage[] }
└── Current limitation: TEXT ONLY (no image attachments)
```

### 2. CHAT EDGE FUNCTION (Main orchestrator)
```
supabase/functions/chat/index.ts
├── Uses: ToolLoopAgent from 'ai' package
├── Model: openai/gpt-4o-mini (via AI Gateway)
├── Role: Cooking assistant for recipe app
└── Tools:
    ├── findRecipe (semantic search)
    └── createRecipe (save new recipes)
```

### 3. TOOLS (Executed by ToolLoopAgent)

#### findRecipe
```
Location: supabase/functions/chat/tools/find-recipe.ts
Input Schema:
  - searchQuery: string (required)
  - category: string | null
  - tags: string[] | null
  - maxTime: number | null
  - matchCount: number (default: 3)
Action: 
  1. Generate embedding via OpenAI text-embedding-3-small
  2. Call search_recipes RPC (pgvector similarity search)
Output: { success, message, recipes[] }
```

#### createRecipe
```
Location: supabase/functions/chat/tools/create-recipe.ts
Input Schema:
  - recipe: { title, description, prep_time, cook_time, servings, category }
  - ingredients: { name, amount, unit, sort_order }[]
  - steps: { instruction, sort_order }[]
Action:
  1. Resolve category name → UUID
  2. Call create-recipe edge function via supabase.functions.invoke()
Output: { success, message, recipe }
Current limitation: image_url is NOT SUPPORTED
```

### 4. CREATE-RECIPE EDGE FUNCTION
```
Location: supabase/functions/create-recipe/index.ts
Input: { recipe, ingredients, steps }
Action:
  1. Validate with Zod schema
  2. Call create_recipe RPC (database transaction)
  3. Fire-and-forget: trigger embed-recipe for embeddings
Output: { success, data: createdRecipe }
Expects: image_url as URL string (not base64)
```

---

## DATA FLOW (Current - Text Only)

```
User types message
    ↓
Angular: chat.sendMessage({ text: "..." })
    ↓
POST /functions/v1/chat { messages: UIMessage[] }
    ↓
ToolLoopAgent processes with gpt-4o-mini
    ↓
Model decides: respond OR call tool
    ↓
If tool call → execute tool → return result to model
    ↓
Stream response back to client
```

---

## IMAGE UPLOAD REQUIREMENT

### Goal
Allow users to attach images when chatting (e.g., photo of a recipe to parse).

### Constraint
- `create-recipe` edge function expects `image_url` as a URL string
- It does NOT currently handle base64/data URLs

### Three Implementation Options

#### OPTION A: Upload in Client First
```
User selects image
    ↓
Client uploads to Supabase Storage → gets URL
    ↓
Client sends message with imageUrl in metadata
    ↓
Tool receives URL, passes to edge function
```
- Pro: Edge function unchanged
- Con: Model cannot "see" the image (no vision)

#### OPTION B: Data URL Through Entire Flow
```
User selects image
    ↓
Client converts to data URL (base64)
    ↓
Send as message part: { type: 'file', mediaType: 'image/*', url: dataURL }
    ↓
Model can see image (vision capable)
    ↓
Tool receives base64, passes to edge function
    ↓
Edge function uploads to storage
```
- Pro: Model has vision capability
- Con: Edge function must handle base64, payload limits (~4.5MB)

#### OPTION C: Hybrid (Recommended)
```
User selects image
    ↓
Client sends as data URL in message parts
    ↓
Model sees image (vision) + decides to call createRecipe
    ↓
createRecipe TOOL uploads base64 to Supabase Storage
    ↓
Tool gets URL back, passes URL to edge function
    ↓
Edge function receives URL (no changes needed)
```
- Pro: Vision + existing edge function works + clean separation
- Con: Tool needs Supabase Storage access

---

## KEY FILES FOR IMAGE IMPLEMENTATION

| File | Current State | Changes Needed |
|------|---------------|----------------|
| `src/app/components/ai-chat/ai-chat.ts` | Text only | Add file input, convert to data URL |
| `supabase/functions/chat/index.ts` | No image handling | Model already supports vision (gpt-4o) |
| `supabase/functions/chat/tools/create-recipe.ts` | image_url: undefined | Upload base64 → get URL |
| `supabase/functions/create-recipe/index.ts` | Expects URL | No changes (Option C) |

---

## VERCEL AI SDK V5 IMAGE FORMAT

```typescript
// Client-side: convert file to data URL
sendMessage({
  role: 'user',
  parts: [
    { type: 'text', text: 'Save this recipe' },
    { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,...' }
  ]
});

// Server-side: convertToModelMessages handles conversion
const result = streamText({
  model: 'openai/gpt-4o', // vision capable
  messages: await convertToModelMessages(messages),
});
```

