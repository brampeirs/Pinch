import { tool } from 'npm:ai';
import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod';
import { decodeBase64 } from 'jsr:@std/encoding@1/base64';

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

// Store for images extracted from messages - set by the chat function
let availableImages: Array<{ url: string; mediaType: string }> = [];

export function setAvailableImages(images: Array<{ url: string; mediaType: string }>) {
    availableImages = images;
    console.log(`📷 Set ${images.length} available images for upload`);
}

export function createUploadImageTool(supabase: SupabaseClient) {
    return tool({
        description: `Upload an image to storage and get a public URL.
Use this when the user provides images and you need to store one as a recipe cover photo.

When the user uploads multiple images:
- Identify which image is the "cover photo" (nicely plated dish, good composition, finished product)
- vs which is the "recipe source" (text, ingredients list, handwritten notes)
- Use imageIndex to select which image to upload (0 = first image, 1 = second image, etc.)

Returns the public URL that can be passed to createRecipe as image_url.`,
        inputSchema: uploadImageInputSchema,
        execute: async ({ imageIndex, purpose }) => {
            console.log('📸 uploadImage called:', { imageIndex, purpose, availableCount: availableImages.length });

            try {
                // Get image from available images
                if (imageIndex < 0 || imageIndex >= availableImages.length) {
                    return {
                        success: false,
                        error: `Invalid image index ${imageIndex}. Available images: ${availableImages.length}`,
                    };
                }

                const image = availableImages[imageIndex];
                const imageDataUrl = image.url;

                console.log(`📷 Image URL length: ${imageDataUrl?.length ?? 0}`);
                console.log(`📷 Image URL starts with: ${imageDataUrl?.substring(0, 50)}`);

                // Parse the data URL
                const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
                if (!matches) {
                    console.log(`❌ Data URL regex did not match`);
                    return {
                        success: false,
                        error: 'Invalid data URL format',
                    };
                }

                const mimeType = matches[1];
                const base64Data = matches[2];
                console.log(`📷 Parsed mimeType: ${mimeType}, base64 length: ${base64Data.length}`);

                // Determine file extension
                const extMap: Record<string, string> = {
                    'image/jpeg': 'jpg',
                    'image/png': 'png',
                    'image/gif': 'gif',
                    'image/webp': 'webp',
                };
                const ext = extMap[mimeType] || 'jpg';

                // Generate unique filename
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 15);
                const filename = `recipes/${timestamp}-${random}.${ext}`;

                // Decode base64 to binary
                const imageData = decodeBase64(base64Data);
                console.log(`📷 Decoded image size: ${imageData.byteLength} bytes`);

                if (imageData.byteLength === 0) {
                    return {
                        success: false,
                        error: 'Decoded image is empty (0 bytes)',
                    };
                }

                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('recipe-images')
                    .upload(filename, imageData, {
                        contentType: mimeType,
                        upsert: false,
                    });

                if (uploadError) {
                    console.error('❌ Upload error:', uploadError);
                    return {
                        success: false,
                        error: uploadError.message,
                    };
                }

                // Get public URL
                const {
                    data: { publicUrl },
                } = supabase.storage.from('recipe-images').getPublicUrl(filename);

                console.log('✅ Image uploaded:', publicUrl);

                return {
                    success: true,
                    url: publicUrl,
                    message: `Image uploaded successfully`,
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
