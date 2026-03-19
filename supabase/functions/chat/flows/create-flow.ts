import { streamText, stepCountIs, type ModelMessage } from 'npm:ai';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { createCreateRecipeTool } from '../tools/create-recipe.ts';
import { createGetCategoriesTool } from '../tools/get-categories.ts';
import { createChooseCoverImageTool } from '../tools/upload-image.ts';

const CREATE_PROMPT_BASE = `You are a recipe creation assistant for a cooking app called Pinch.
Your job is to extract recipe data from the user's message and save it to the database.

**EXTRACTION RULES:**
- Extract title, description, ingredients (with amounts and units), and steps from the user's text.
- If the user pastes a full recipe, extract ALL ingredients and ALL steps — do not summarize or skip.
- Preserve the original language of the recipe (ingredient names, step descriptions).
- If the recipe has sections (e.g. "De Saus", "Het Deeg"), use section_name on ingredients and steps.
- Estimate prep_time and cook_time in minutes if not explicitly stated.
- Estimate servings if not explicitly stated.
- Write a short, appetizing description if the user didn't provide one.

**CATEGORY SELECTION:**
- Call getCategories to get the list of available categories.
- Pick the best matching category by ID.
- If no category fits well, use the "Overig" (Other) category.

**AFTER CREATION:**
- The UI renders the created recipe as a card — you do NOT need to repeat all the details.
- Respond with a brief confirmation in the same language the user wrote in.
- Keep it to one short sentence, e.g. "Recept opgeslagen!" or "Recipe saved!"

**LANGUAGE:**
- Respond in the same language the user writes in.
`;

function buildCreatePrompt(hasImages: boolean, imageCount: number): string {
    if (!hasImages) {
        return (
            CREATE_PROMPT_BASE +
            `\n**WORKFLOW:**
1. Call getCategories to get available categories.
2. Call createRecipe with the extracted recipe data and the best matching category_id.`
        );
    }

    return (
        CREATE_PROMPT_BASE +
        `\n**IMAGES:**
The user has attached ${imageCount} image(s). Classify each image:
- **Recipe source** — a photo of text, a screenshot, handwritten notes, a cookbook page. Extract the recipe content from this image.
- **Cover photo** — a nicely plated dish, appetizing food photo. Upload this as the recipe cover image.

**WORKFLOW WITH IMAGES:**
1. Call getCategories to get available categories.
2. If there is a cover photo, call chooseCoverImage to store it permanently (use the imageIndex of the cover photo).
3. Extract recipe content from text in the message AND/OR from recipe source images.
4. Call createRecipe with the extracted data, the best category_id, and the image_url from chooseCoverImage (if available).

**CRITICAL:** If you called chooseCoverImage, you MUST pass its returned URL as image_url in createRecipe.`
    );
}

/**
 * Runs the create flow: streamText with getCategories + createRecipe tools.
 * When images are present, also includes chooseCoverImage
 */
export function runCreateFlow(
    aiGateway: { languageModel: (model: string) => unknown },
    supabase: SupabaseClient,
    messages: ModelMessage[],
    images: Array<{ url: string; mediaType: string }> = [],
) {
    const hasImages = images.length > 0;

    // deno-lint-ignore no-explicit-any
    const tools: Record<string, any> = {
        getCategories: createGetCategoriesTool(supabase),
        createRecipe: createCreateRecipeTool(supabase),
    };

    if (hasImages) {
        const chooseCoverImage = createChooseCoverImageTool(supabase, images);
        tools.chooseCoverImage = chooseCoverImage;
    }

    return streamText({
        model: aiGateway.languageModel('openai/gpt-4o'),
        tools,
        system: buildCreatePrompt(hasImages, images.length),
        messages,
        // More steps when images are involved: getCategories → chooseCoverImage → createRecipe → text
        stopWhen: stepCountIs(hasImages ? 7 : 5),
    });
}
