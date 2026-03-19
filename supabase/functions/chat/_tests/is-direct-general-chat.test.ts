import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDirectGeneralChat } from "../_lib/is-direct-general-chat.ts";

function detect(
  userText: string,
  overrides: Partial<Parameters<typeof isDirectGeneralChat>[0]> = {},
) {
  return isDirectGeneralChat({
    userText,
    hasContextRecipeId: false,
    hasImages: false,
    hasSearchResults: false,
    ...overrides,
  });
}

Deno.test("matches simple English small talk", () => {
  assertEquals(detect("hello"), true);
  assertEquals(detect("thanks!"), true);
});

Deno.test("matches simple Dutch small talk", () => {
  assertEquals(detect("hallo"), true);
  assertEquals(detect("bedankt!"), true);
});

Deno.test("matches English cooking advice questions", () => {
  assertEquals(detect("How do I sharpen a knife?"), true);
  assertEquals(
    detect("What is the difference between baking soda and baking powder?"),
    true,
  );
});

Deno.test("matches Dutch cooking advice questions", () => {
  assertEquals(detect("Hoe slijp ik een mes?"), true);
  assertEquals(
    detect("Wat is het verschil tussen bakpoeder en baking soda?"),
    true,
  );
});

Deno.test("does not match search, detail, or create phrasing", () => {
  assertEquals(detect("what can I make with chicken and rice?"), false);
  assertEquals(detect("how do I make pasta?"), false);
  assertEquals(detect("ik zoek een spicy soep"), false);
  assertEquals(detect("save this recipe"), false);
  assertEquals(detect("what are the ingredients?"), false);
});

Deno.test("does not match when flow-specific context already exists", () => {
  assertEquals(detect("hello", { hasContextRecipeId: true }), false);
  assertEquals(detect("hello", { hasSearchResults: true }), false);
  assertEquals(detect("hello", { hasImages: true }), false);
});
