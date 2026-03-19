import { tool } from 'npm:ai';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod';

const uploadImageInputSchema = z.object({
    imageIndex: z
        .number()
        .describe(
            'The index of the image to upload (0 for the first image, 1 for the second, etc.). Use the image that looks like a cover photo (nicely plated dish, good lighting).',
        ),
    purpose: z
        .enum(['recipe-cover', 'recipe-step'])
        .describe('The purpose of the image: "recipe-cover" for the main recipe photo'),
});

export function createUploadImageTool(
    supabase: SupabaseClient,
    availableImages: Array<{ url: string; mediaType: string }> = [],
) {
    return tool({
        description: `Upload an image to permanent storage and get a public URL.
Use this when the user provides images and you need to store one as a recipe cover photo.
Images are pre-uploaded to temporary storage. This tool copies them to permanent storage.

When the user uploads multiple images:
- Identify which image is the "cover photo" (nicely plated dish, good composition, finished product)
- vs which is the "recipe source" (text, ingredients list, handwritten notes)
- Use imageIndex to select which image to upload (0 = first image, 1 = second image, etc.)

Returns the public URL that can be passed to createRecipe as image_url.`,
        inputSchema: uploadImageInputSchema,
        execute: async ({ imageIndex, purpose }) => {
            console.log('📸 uploadImage called:', { imageIndex, purpose, availableCount: availableImages.length });

            try {
                // Validate image index
                if (imageIndex < 0 || imageIndex >= availableImages.length) {
                    return {
                        success: false,
                        error: `Invalid image index ${imageIndex}. Available images: ${availableImages.length}`,
                    };
                }

                const image = availableImages[imageIndex];
                const sourceUrl = image.url;

                console.log(`📷 Source URL: ${sourceUrl?.substring(0, 100)}`);

                // Extract path from URL: .../recipe-images/chat-uploads/filename.ext
                const pathMatch = sourceUrl.match(/recipe-images\/(.+)$/);
                if (!pathMatch) {
                    console.log(`❌ Could not extract storage path from URL`);
                    return {
                        success: false,
                        error: 'Could not extract storage path from URL',
                    };
                }

                const sourcePath = pathMatch[1]; // chat-uploads/timestamp-random.ext
                console.log(`📷 Source path: ${sourcePath}`);

                // Determine file extension from source
                const extMatch = sourcePath.match(/\.(\w+)$/);
                const ext = extMatch ? extMatch[1] : 'jpg';

                // Generate new filename in recipes/ folder
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 15);
                const destPath = `recipes/${timestamp}-${random}.${ext}`;

                console.log(`📷 Copying: ${sourcePath} → ${destPath}`);

                // Copy file from chat-uploads/ to recipes/
                const { error: copyError } = await supabase.storage.from('recipe-images').copy(sourcePath, destPath);

                if (copyError) {
                    console.error('❌ Copy error:', copyError);
                    return {
                        success: false,
                        error: copyError.message,
                    };
                }

                // Get public URL for the new location
                const {
                    data: { publicUrl },
                } = supabase.storage.from('recipe-images').getPublicUrl(destPath);

                console.log('✅ Image copied to permanent storage:', publicUrl);

                return {
                    success: true,
                    url: publicUrl,
                    message: 'Image uploaded successfully',
                };
            } catch (error) {
                console.error('❌ Upload exception:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
    });
}
