import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

/**
 * Represents an image being uploaded or already uploaded to Supabase Storage.
 */
export interface UploadingImage {
    id: string; // Unique ID for tracking
    file: File; // Original file
    previewUrl: string; // Local blob URL for instant preview
    progress: number; // 0-100
    status: 'uploading' | 'completed' | 'error';
    publicUrl?: string; // Available when completed
    error?: string; // Error message if failed
    mediaType: string; // MIME type (image/jpeg, etc.)
}

/**
 * Service for uploading images to Supabase Storage with progress tracking.
 * Uses XMLHttpRequest for upload progress events (fetch doesn't support upload progress).
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
    private supabase = inject(SupabaseService);

    /**
     * Upload a file to chat-uploads/ with progress tracking.
     * Uses XMLHttpRequest for progress events (fetch doesn't support upload progress).
     */
    async uploadWithProgress(
        file: File,
        onProgress: (percent: number) => void,
    ): Promise<{ url: string | null; error: string | null }> {
        // Generate unique filename
        const fileExt = file.name.split('.').pop() || 'jpg';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const filename = `chat-uploads/${timestamp}-${random}.${fileExt}`;

        // Get signed upload URL from Supabase
        const { data: uploadData, error: signError } = await this.supabase.client.storage
            .from('recipe-images')
            .createSignedUploadUrl(filename);

        if (signError || !uploadData) {
            return { url: null, error: signError?.message || 'Failed to create upload URL' };
        }

        // Upload with XHR for progress tracking
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Get public URL
                    const {
                        data: { publicUrl },
                    } = this.supabase.client.storage.from('recipe-images').getPublicUrl(filename);
                    resolve({ url: publicUrl, error: null });
                } else {
                    resolve({ url: null, error: `Upload failed: ${xhr.status}` });
                }
            };

            xhr.onerror = () => {
                resolve({ url: null, error: 'Network error during upload' });
            };

            xhr.open('PUT', uploadData.signedUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
        });
    }

    /**
     * Create a local preview URL for immediate display.
     */
    createPreviewUrl(file: File): string {
        return URL.createObjectURL(file);
    }

    /**
     * Revoke a preview URL to free memory.
     */
    revokePreviewUrl(url: string): void {
        URL.revokeObjectURL(url);
    }
}

