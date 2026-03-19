/**
 * End-to-end integration tests for the chat function.
 *
 * Each test calls the deployed Supabase Edge Function and validates:
 * 1. Routing — did the router pick the correct intent?
 * 2. Tool usage — were the right tools called (or not)?
 * 3. Response content — does the output make sense?
 *
 * Run with:
 *   npm run test:chat
 *   deno test --no-check --allow-env --allow-net supabase/functions/chat/_tests/
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// --- Setup ---

const CHAT_URL =
    Deno.env.get('CHAT_FUNCTION_URL') ?? 'https://uqnfiqcpmsglspaffync.supabase.co/functions/v1/chat';

interface ChatRequestOpts {
    contextRecipeId?: string;
    // deno-lint-ignore no-explicit-any
    messages?: any[];
}

interface ChatResult {
    status: number;
    events: string[];
    hasToolCall: boolean;
    toolName: string;
    toolNames: string[];
    body: string;
    // deno-lint-ignore no-explicit-any
    toolOutputs: Record<string, any>;
}

// deno-lint-ignore no-explicit-any
function parseSSE(text: string): { events: string[]; hasToolCall: boolean; toolName: string; toolNames: string[]; toolOutputs: Record<string, any> } {
    const events: string[] = [];
    let hasToolCall = false;
    let toolName = '';
    const toolNames: string[] = [];
    // deno-lint-ignore no-explicit-any
    const toolOutputs: Record<string, any> = {};
    // Map toolCallId → toolName (tool-input-start has toolName, tool-output-available only has toolCallId)
    const callIdToName: Record<string, string> = {};

    for (const line of text.split('\n')) {
        const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
        if (!jsonStr.trim()) continue;
        try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type) events.push(parsed.type);
            if (parsed.type === 'tool-input-start' && parsed.toolName && parsed.toolCallId) {
                callIdToName[parsed.toolCallId] = parsed.toolName;
            }
            if (parsed.type === 'tool-input-available' && parsed.toolName) {
                hasToolCall = true;
                toolName = parsed.toolName;
                toolNames.push(parsed.toolName);
            }
            if (parsed.type === 'tool-output-available' && parsed.toolCallId) {
                const name = callIdToName[parsed.toolCallId] || parsed.toolName || 'unknown';
                toolOutputs[name] = parsed.output;
            }
        } catch {
            // skip non-JSON lines
        }
    }

    return { events, hasToolCall, toolName, toolNames, toolOutputs };
}

async function sendChat(userText: string, opts: ChatRequestOpts = {}): Promise<ChatResult> {
    const messages = opts.messages ?? [
        { id: `test-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: userText }] },
    ];

    // If custom messages provided but no trailing user message with userText, add one
    if (opts.messages && userText) {
        const lastMsg = messages[messages.length - 1];
        const lastText = lastMsg?.parts?.find((p: { type: string }) => p.type === 'text')?.text;
        if (lastText !== userText) {
            messages.push({ id: `test-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: userText }] });
        }
    }

    const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages,
            ...(opts.contextRecipeId ? { contextRecipeId: opts.contextRecipeId } : {}),
        }),
    });

    const text = await response.text();
    const parsed = parseSSE(text);

    return { status: response.status, body: text, ...parsed };
}

// ── Search ──────────────────────────────────────────────────────────
// Expect: router → search, findRecipe tool called, tool-output returned

Deno.test('search: "quick pasta with tomato" → findRecipe + recipe card', async () => {
    const r = await sendChat('quick pasta with tomato');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe tool call. Events: ${r.events.join(', ')}`);
    assert(r.body.includes('findRecipe'), 'Expected findRecipe in response');
    assert(r.events.includes('tool-output-available'), 'Expected tool output with recipe data');
});

Deno.test('search: "ik zoek een spicy soep" → findRecipe (Dutch)', async () => {
    const r = await sendChat('ik zoek een spicy soep');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe tool call. Events: ${r.events.join(', ')}`);
    assert(r.body.includes('findRecipe'), 'Expected findRecipe in response');
});

Deno.test('search: "vegetarian dinner under 30 minutes" → findRecipe with filters', async () => {
    const r = await sendChat('vegetarian dinner under 30 minutes');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe tool call. Events: ${r.events.join(', ')}`);
});

Deno.test('search: "what can I make with chicken and rice?" → findRecipe', async () => {
    const r = await sendChat('what can I make with chicken and rice?');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe tool call. Events: ${r.events.join(', ')}`);
});

// ── General chat ────────────────────────────────────────────────────
// Expect: router → generalChat, NO tools, text-only response

Deno.test('chat: "why does bread need yeast?" → text answer, no tools', async () => {
    const r = await sendChat('why does bread need yeast? explain briefly');
    assertEquals(r.status, 200);
    assert(!r.hasToolCall, `Expected NO tool calls. Events: ${r.events.join(', ')}`);
    assert(r.events.includes('text-delta'), 'Expected streamed text response');
    assert(
        r.body.toLowerCase().includes('yeast') || r.body.toLowerCase().includes('rise') || r.body.toLowerCase().includes('ferment'),
        'Expected response to discuss yeast/fermentation',
    );
});

Deno.test('chat: "hello" → friendly greeting, no tools', async () => {
    const r = await sendChat('hello');
    assertEquals(r.status, 200);
    assert(!r.hasToolCall, `Expected NO tool calls. Events: ${r.events.join(', ')}`);
    assert(r.events.includes('text-delta'), 'Expected streamed text response');
});

Deno.test('chat: "how do I sharpen a knife?" → cooking tip, no tools', async () => {
    const r = await sendChat('how do I sharpen a knife?');
    assertEquals(r.status, 200);
    assert(!r.hasToolCall, `Expected NO tool calls. Events: ${r.events.join(', ')}`);
    assert(r.events.includes('text-delta'), 'Expected streamed text response');
});

// ── Search phrasing variants ─────────────────────────────────────
// Slice 2: verify consistent routing across different phrasings

Deno.test('search: "🍝" (emoji-only) → findRecipe', async () => {
    const r = await sendChat('🍝');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe for emoji query. Events: ${r.events.join(', ')}`);
});

Deno.test('search: "soep" (single Dutch word) → findRecipe', async () => {
    const r = await sendChat('soep');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe for single-word query. Events: ${r.events.join(', ')}`);
});

Deno.test('search: "I want something with aubergine and miso" → findRecipe', async () => {
    const r = await sendChat('I want something with aubergine and miso');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe. Events: ${r.events.join(', ')}`);
});

Deno.test('search: no stray prose when recipes found', async () => {
    const r = await sendChat('pasta');
    assertEquals(r.status, 200);
    assert(r.hasToolCall, `Expected findRecipe. Events: ${r.events.join(', ')}`);

    // Count text-delta events — search with results should have minimal or zero assistant text
    const textDeltas = r.events.filter(e => e === 'text-delta');
    // Allow up to 5 text-delta events (a small tolerance for edge cases),
    // but a chatty response would have 20+
    assert(textDeltas.length <= 5, `Too much assistant prose after search results: ${textDeltas.length} text-delta events`);
});


// ── Detail from search history ─────────────────────────────────
// Slice 3: follow-up after search should route to detail and call getRecipeDetail

Deno.test('detail: "how do I make the first one?" after search → getRecipeDetail', async () => {
    // Step 1: do a real search to get recipe data
    const searchResult = await sendChat('pasta');
    assertEquals(searchResult.status, 200);
    assert(searchResult.hasToolCall, 'Search should call findRecipe');

    const recipes = searchResult.toolOutputs['findRecipe']?.recipes;
    assert(recipes && recipes.length > 0, 'Search should return at least one recipe');

    const firstRecipe = recipes[0];

    // Step 2: simulate multi-turn — send a follow-up with the search history
    const followUp = await sendChat('how do I make the first one?', {
        messages: [
            { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'pasta' }] },
            {
                id: 'a1',
                role: 'assistant',
                parts: [
                    {
                        type: 'tool-findRecipe',
                        toolCallId: 'call-1',
                        toolName: 'findRecipe',
                        state: 'output-available',
                        input: { searchQuery: 'pasta' },
                        output: { recipes },
                    },
                ],
            },
        ],
    });

    assertEquals(followUp.status, 200);
    assert(
        followUp.toolNames.includes('getRecipeDetail'),
        `Expected getRecipeDetail tool call, got: ${followUp.toolNames.join(', ') || 'none'}. Events: ${followUp.events.join(', ')}`,
    );
    // Should produce a text response with recipe details
    assert(followUp.events.includes('text-delta'), 'Expected text response with recipe details');
    // The response should mention the recipe title
    assert(
        followUp.body.toLowerCase().includes(firstRecipe.title.toLowerCase().split(' ')[0]),
        `Expected response to reference recipe "${firstRecipe.title}"`,
    );
});

Deno.test('detail: "wat zijn de ingrediënten?" with contextRecipeId → getRecipeDetail', async () => {
    // First get a valid recipe ID from search
    const searchResult = await sendChat('quick pasta with tomato');
    assertEquals(searchResult.status, 200);
    const recipes = searchResult.toolOutputs['findRecipe']?.recipes;
    assert(recipes && recipes.length > 0, `Search should return at least one recipe. toolOutputs: ${JSON.stringify(searchResult.toolOutputs)}`);

    const r = await sendChat('wat zijn de ingrediënten?', { contextRecipeId: recipes[0].id });
    assertEquals(r.status, 200);
    assert(
        r.toolNames.includes('getRecipeDetail'),
        `Expected getRecipeDetail tool call. Events: ${r.events.join(', ')}`,
    );
    assert(r.events.includes('text-delta'), 'Expected text response with ingredients');
});


// ── Create flow ──────────────────────────────────────────────
// Slice 4: recipe creation from text

Deno.test('create: "save this recipe: Simple Toast" → getCategories + createRecipe', async () => {
    const r = await sendChat(
        `Save this recipe:

Title: Test Toast ${Date.now()}
Servings: 1

Ingredients:
- 1 slice bread
- 1 tbsp butter

Steps:
1. Toast the bread until golden
2. Spread butter on top
3. Serve immediately`,
    );

    assertEquals(r.status, 200);
    // Should call getCategories first, then createRecipe
    assert(
        r.toolNames.includes('createRecipe'),
        `Expected createRecipe tool call, got: ${r.toolNames.join(', ') || 'none'}. Events: ${r.events.join(', ')}`,
    );
    // Should produce a confirmation text
    assert(r.events.includes('text-delta'), 'Expected text confirmation after recipe creation');
    // The createRecipe output should have success
    const createOutput = r.toolOutputs['createRecipe'];
    assert(createOutput?.success, `Expected createRecipe to succeed. Output: ${JSON.stringify(createOutput)}`);
    assert(createOutput?.recipe?.id, 'Expected created recipe to have an ID');
});