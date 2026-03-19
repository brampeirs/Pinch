interface DirectGeneralChatOptions {
  userText: string;
  hasContextRecipeId: boolean;
  hasImages: boolean;
  hasSearchResults: boolean;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhrases(phrases: string[]): string[] {
  return phrases.map(normalizeText);
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

const SMALL_TALK_PHRASES = new Set(
  normalizePhrases([
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
    "thanks",
    "thank you",
    "hoi",
    "hallo",
    "goedemorgen",
    "goedemiddag",
    "goedenavond",
    "dankje",
    "dank je",
    "bedankt",
  ]),
);

const SEARCH_PHRASES = normalizePhrases([
  "recipe",
  "recipes",
  "find me",
  "search for",
  "what can i make with",
  "what can i cook with",
  "i want something with",
  "ik zoek",
  "zoek",
  "zoeken",
  "recept",
  "recepten",
  "wat kan ik maken met",
]);

const DETAIL_PHRASES = normalizePhrases([
  "ingredients",
  "ingredienten",
  "how do i make",
  "how to make",
  "the first one",
  "that one",
  "this recipe",
  "how long does this take",
  "de eerste",
  "die ene",
  "dit recept",
  "hoe maak ik",
  "hoe maak je",
  "hoe lang duurt dit",
]);

const CREATE_PHRASES = normalizePhrases([
  "save this recipe",
  "save recipe",
  "add recipe",
  "create recipe",
  "opslaan",
  "bewaar",
  "recept toevoegen",
  "maak recept",
]);

const GENERAL_CHAT_PREFIXES = normalizePhrases([
  "how do i",
  "what is",
  "what s",
  "what is the difference between",
  "why does",
  "why do",
  "can i",
  "any tips for",
  "tips for",
  "hoe",
  "wat is",
  "wat is het verschil tussen",
  "waarom",
  "kan ik",
  "tips voor",
  "tips om",
]);

const COOKING_TERMS = normalizePhrases([
  "baking soda",
  "baking powder",
  "yeast",
  "knife",
  "rice",
  "pasta",
  "bread",
  "dough",
  "oven",
  "pan",
  "cook",
  "cooking",
  "bake",
  "baking",
  "sharpen",
  "salt",
  "sauce",
  "bakpoeder",
  "gist",
  "mes",
  "rijst",
  "brood",
  "deeg",
  "pan",
  "koken",
  "bakken",
  "snijden",
  "saus",
]);

export function isDirectGeneralChat({
  userText,
  hasContextRecipeId,
  hasImages,
  hasSearchResults,
}: DirectGeneralChatOptions): boolean {
  if (hasImages || hasContextRecipeId || hasSearchResults) {
    return false;
  }

  const normalized = normalizeText(userText);
  if (!normalized || normalized.length > 160) {
    return false;
  }

  if (SMALL_TALK_PHRASES.has(normalized)) {
    return true;
  }

  if (
    includesAny(normalized, SEARCH_PHRASES) ||
    includesAny(normalized, DETAIL_PHRASES) ||
    includesAny(normalized, CREATE_PHRASES)
  ) {
    return false;
  }

  const hasGeneralChatPrefix = GENERAL_CHAT_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix)
  );
  const hasCookingTerm = includesAny(normalized, COOKING_TERMS);

  return hasGeneralChatPrefix && hasCookingTerm;
}
