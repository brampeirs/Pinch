import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { z } from 'zod';
import { ImageUploadService, type UploadingImage } from '../../services/image-upload.service';
import {
    SupabaseService,
    type CreateRecipeFromImagesStreamResult,
    type UploadedRecipeImage,
} from '../../services/supabase.service';

const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);
const createRecipeFromImagesProgressStageSchema = z.enum([
    'images_received',
    'analyzing_images',
    'extracting_recipe',
    'choosing_cover',
    'saving_recipe',
]);
const createRecipeFromImagesStreamEventSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('status'),
        stage: createRecipeFromImagesProgressStageSchema,
    }),
    z.object({
        type: z.literal('result'),
        recipeId: z.string().min(1),
    }),
    z.object({
        type: z.literal('error'),
        message: z.string().min(1),
    }),
]);

type CreationStageStatus = 'pending' | 'active' | 'complete';
type CreateRecipeFromImagesProgressStage = z.infer<typeof createRecipeFromImagesProgressStageSchema>;
type CreateRecipeFromImagesStreamEvent = z.infer<typeof createRecipeFromImagesStreamEventSchema>;
type CreationMilestoneKey = keyof Pick<
    CreateRecipeFromImagesStreamResult,
    'imagesReceived' | 'analyzingImages' | 'extractingRecipe' | 'choosingCover' | 'savingRecipe'
>;

const progressStageToMilestoneKey: Record<CreateRecipeFromImagesProgressStage, CreationMilestoneKey> = {
    images_received: 'imagesReceived',
    analyzing_images: 'analyzingImages',
    extracting_recipe: 'extractingRecipe',
    choosing_cover: 'choosingCover',
    saving_recipe: 'savingRecipe',
};

interface CreationStage {
    label: string;
    status: CreationStageStatus;
}

@Component({
    selector: 'app-upload-recipe-photos',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink],
    templateUrl: './upload-recipe-photos.html',
})
export class UploadRecipePhotosPage {
    private readonly destroyRef = inject(DestroyRef);
    private readonly router = inject(Router);
    private readonly imageUploadService = inject(ImageUploadService);
    private readonly supabaseService = inject(SupabaseService);
    private readonly uploadTasks = new Map<string, Promise<void>>();
    private creationAbortController: AbortController | null = null;
    private creationRequestId = 0;

    readonly selectedImages = signal<UploadingImage[]>([]);
    readonly validationMessage = signal<string | null>(null);
    readonly isDragActive = signal(false);
    readonly creationState = signal<'idle' | 'creating'>('idle');
    readonly creationMilestones = signal<CreateRecipeFromImagesStreamResult | undefined>(undefined);

    readonly hasImages = computed(() => this.selectedImages().length > 0);
    readonly completedImages = computed(() =>
        this.selectedImages().filter((image) => image.status === 'completed' && image.publicUrl),
    );
    readonly canCreateDraft = computed(
        () =>
            this.selectedImages().some((image) => image.status === 'uploading' || image.status === 'completed') &&
            this.creationState() !== 'creating',
    );
    readonly selectedCountLabel = computed(() => {
        const count = this.selectedImages().length;
        return count === 1 ? '1 photo selected' : `${count} photos selected`;
    });
    readonly uploadSummaryLabel = computed(() => {
        const images = this.selectedImages();

        if (images.length === 0) {
            return null;
        }

        const completedCount = images.filter((image) => image.status === 'completed' && image.publicUrl).length;
        const uploadingCount = images.filter((image) => image.status === 'uploading').length;
        const failedCount = images.filter((image) => image.status === 'error').length;
        const parts: string[] = [];

        if (completedCount > 0) {
            parts.push(completedCount === 1 ? '1 ready' : `${completedCount} ready`);
        }

        if (uploadingCount > 0) {
            parts.push(uploadingCount === 1 ? '1 uploading' : `${uploadingCount} uploading`);
        }

        if (failedCount > 0) {
            parts.push(failedCount === 1 ? '1 failed' : `${failedCount} failed`);
        }

        return parts.join(' · ');
    });
    readonly createButtonLabel = computed(() => {
        if (this.creationState() === 'creating') {
            return 'Creating recipe...';
        }

        return 'Create recipe';
    });
    readonly creationStages = computed<CreationStage[]>(() => {
        const milestones = this.creationMilestones();
        const isCreating = this.creationState() === 'creating';
        const hasStreamStarted = milestones !== undefined;
        const hasSavingStarted =
            milestones?.savingRecipe === true || milestones?.recipeId !== undefined || milestones?.error !== undefined;
        const hasChoosingStarted = milestones?.choosingCover === true;
        const hasReadingStarted =
            milestones?.imagesReceived === true ||
            milestones?.analyzingImages === true ||
            milestones?.extractingRecipe === true ||
            hasChoosingStarted ||
            hasSavingStarted;

        return [
            {
                label: 'Preparing your photos',
                status: !isCreating ? 'pending' : hasStreamStarted ? 'complete' : 'active',
            },
            {
                label: 'Reading recipe details from the images',
                status: !hasReadingStarted ? 'pending' : hasChoosingStarted || hasSavingStarted ? 'complete' : 'active',
            },
            {
                label: 'Choosing the best cover photo if needed',
                status: hasChoosingStarted
                    ? hasSavingStarted
                        ? 'complete'
                        : 'active'
                    : hasSavingStarted
                      ? 'complete'
                      : 'pending',
            },
            {
                label: 'Saving your recipe',
                status: !hasSavingStarted ? 'pending' : milestones?.recipeId !== undefined ? 'complete' : 'active',
            },
        ];
    });
    readonly creationDescription = computed(() => {
        const milestones = this.creationMilestones();

        if (!milestones) {
            return 'We are finishing any remaining uploads before the AI starts reading your photos.';
        }

        if (milestones.savingRecipe) {
            return 'We are saving the extracted recipe into your collection.';
        }

        if (milestones.choosingCover) {
            return 'We are picking the best photo to use as the cover when one is available.';
        }

        if (milestones.extractingRecipe) {
            return 'We are turning the image contents into structured recipe details.';
        }

        return 'We are reading the uploaded images and figuring out the recipe details.';
    });

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.resetCreationState();
            this.releaseAllPreviews();
        });
    }

    onFilesSelected(event: Event) {
        const input = event.target as HTMLInputElement | null;
        const files = input?.files ? Array.from(input.files) : [];

        if (files.length === 0) {
            return;
        }

        this.addFiles(files);

        if (input) {
            input.value = '';
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        this.isDragActive.set(true);
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        this.isDragActive.set(false);
    }

    onFilesDropped(event: DragEvent) {
        event.preventDefault();
        this.isDragActive.set(false);

        const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
        if (files.length === 0) {
            return;
        }

        this.addFiles(files);
    }

    removeImage(imageId: string) {
        this.resetCreationState();
        this.uploadTasks.delete(imageId);

        const image = this.selectedImages().find((item) => item.id === imageId);
        if (image) {
            this.imageUploadService.revokePreviewUrl(image.previewUrl);
        }

        this.selectedImages.update((current) => current.filter((item) => item.id !== imageId));
        if (this.selectedImages().length === 0) {
            this.validationMessage.set(null);
        }
    }

    retryUpload(imageId: string) {
        this.resetCreationState();

        const image = this.selectedImages().find((item) => item.id === imageId);
        if (!image || image.status === 'uploading') {
            return;
        }

        const upload = {
            ...image,
            status: 'uploading' as const,
            progress: 0,
            publicUrl: undefined,
            error: undefined,
        };

        this.selectedImages.update((current) => current.map((item) => (item.id === imageId ? upload : item)));
        void this.startUpload(upload);
    }

    async createDraftPreview() {
        if (!this.canCreateDraft()) {
            this.validationMessage.set('Add a photo that is uploading or retry a failed upload before continuing.');
            return;
        }

        this.validationMessage.set(null);
        const requestId = this.beginRecipeCreation();

        const images = await this.waitForUploadsToSettle();
        if (!this.isCreationRequestCurrent(requestId)) {
            return;
        }

        if (images.length === 0) {
            this.resetCreationState();
            this.validationMessage.set(
                'At least one photo needs to upload successfully before a recipe can be created.',
            );
            return;
        }

        try {
            const milestones = await this.createRecipeFromImages(images, requestId);
            if (!this.isCreationRequestCurrent(requestId)) {
                return;
            }

            if (!milestones?.recipeId) {
                this.resetCreationState();
                this.validationMessage.set(
                    milestones?.error || 'We could not create a recipe from these photos. Please try again.',
                );
                return;
            }

            await this.router.navigate(['/recipes', milestones.recipeId]);
        } catch (error) {
            if (this.isAbortError(error) || !this.isCreationRequestCurrent(requestId)) {
                return;
            }

            this.resetCreationState();
            this.validationMessage.set(
                error instanceof Error
                    ? error.message
                    : 'We could not create a recipe from these photos. Please try again.',
            );
        }
    }

    private resetCreationState() {
        this.creationRequestId += 1;
        this.creationAbortController?.abort();
        this.creationAbortController = null;
        this.creationMilestones.set(undefined);
        this.creationState.set('idle');
    }

    private addFiles(files: File[]) {
        this.resetCreationState();

        const acceptedFiles = files.filter((file) => this.isSupportedFile(file));
        const rejectedHeicCount = files.filter((file) => this.isHeicFile(file)).length;
        const rejectedOtherCount = files.length - acceptedFiles.length - rejectedHeicCount;

        if (acceptedFiles.length > 0) {
            const newImages = acceptedFiles.map((file) => this.buildSelectedImage(file));
            this.selectedImages.update((current) => [...current, ...newImages]);

            newImages.forEach((image) => {
                void this.startUpload(image);
            });
        }

        this.validationMessage.set(this.buildValidationMessage(rejectedHeicCount, rejectedOtherCount));
    }

    private buildSelectedImage(file: File): UploadingImage {
        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            previewUrl: this.imageUploadService.createPreviewUrl(file),
            progress: 0,
            status: 'uploading',
            mediaType: file.type,
        };
    }

    private startUpload(image: UploadingImage) {
        const uploadTask = this.imageUploadService
            .uploadWithProgress(image.file, (progress) => {
                this.selectedImages.update((current) =>
                    current.map((item) => (item.id === image.id ? { ...item, progress } : item)),
                );
            })
            .then(({ url, error }) => {
                this.selectedImages.update((current) =>
                    current.map((item) => {
                        if (item.id !== image.id) {
                            return item;
                        }

                        if (error) {
                            return {
                                ...item,
                                status: 'error' as const,
                                error,
                            };
                        }

                        return {
                            ...item,
                            status: 'completed' as const,
                            progress: 100,
                            publicUrl: url ?? undefined,
                            error: undefined,
                        };
                    }),
                );
            })
            .finally(() => {
                if (this.uploadTasks.get(image.id) === uploadTask) {
                    this.uploadTasks.delete(image.id);
                }
            });

        this.uploadTasks.set(image.id, uploadTask);
        return uploadTask;
    }

    private isSupportedFile(file: File): boolean {
        const lowerName = file.name.toLowerCase();
        return (
            SUPPORTED_MIME_TYPES.has(file.type) ||
            lowerName.endsWith('.jpg') ||
            lowerName.endsWith('.jpeg') ||
            lowerName.endsWith('.png') ||
            lowerName.endsWith('.webp')
        );
    }

    private isHeicFile(file: File): boolean {
        const lowerName = file.name.toLowerCase();
        return HEIC_MIME_TYPES.has(file.type) || lowerName.endsWith('.heic') || lowerName.endsWith('.heif');
    }

    private buildValidationMessage(rejectedHeicCount: number, rejectedOtherCount: number): string | null {
        if (rejectedHeicCount > 0) {
            return 'HEIC/HEIF photos are not supported yet. Please use JPG, PNG, or WebP.';
        }

        if (rejectedOtherCount > 0) {
            return 'Only JPG, PNG, and WebP images are supported in this preview.';
        }

        return null;
    }

    private async waitForUploadsToSettle(): Promise<UploadedRecipeImage[]> {
        const pendingUploads = Array.from(this.uploadTasks.values());
        if (pendingUploads.length > 0) {
            await Promise.allSettled(pendingUploads);
        }

        return this.completedImages().map((image) => ({
            url: image.publicUrl!,
            mediaType: image.mediaType,
        }));
    }

    private releaseAllPreviews() {
        this.selectedImages().forEach((image) => this.imageUploadService.revokePreviewUrl(image.previewUrl));
    }

    private beginRecipeCreation() {
        this.creationAbortController?.abort();
        this.creationAbortController = null;
        this.creationRequestId += 1;
        this.creationMilestones.set(undefined);
        this.creationState.set('creating');
        return this.creationRequestId;
    }

    private isCreationRequestCurrent(requestId: number) {
        return this.creationRequestId === requestId;
    }

    private isAbortError(error: unknown) {
        return error instanceof Error && error.name === 'AbortError';
    }

    private async createRecipeFromImages(images: UploadedRecipeImage[], requestId: number) {
        const abortController = new AbortController();
        this.creationAbortController = abortController;

        const response = await this.supabaseService.createRecipeFromImagesStreamFetch('create-recipe-from-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ images }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            throw new Error(await this.getRecipeCreationErrorMessage(response));
        }

        if (!response.body) {
            throw new Error('The recipe creation service did not return a readable progress stream.');
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        let shouldCancelReader = false;

        try {
            while (this.isCreationRequestCurrent(requestId)) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += value;
                buffer = this.processRecipeCreationBuffer(buffer);

                if (this.hasRecipeCreationCompleted()) {
                    shouldCancelReader = true;
                    break;
                }
            }

            if (buffer.trim().length > 0 && this.isCreationRequestCurrent(requestId)) {
                this.applyRecipeCreationEvent(this.parseRecipeCreationEvent(buffer));

                if (this.hasRecipeCreationCompleted()) {
                    shouldCancelReader = true;
                }
            }

            return this.creationMilestones();
        } finally {
            if (shouldCancelReader) {
                await reader.cancel();
            }

            reader.releaseLock();

            if (this.creationAbortController === abortController) {
                this.creationAbortController = null;
            }
        }
    }

    private processRecipeCreationBuffer(buffer: string) {
        const lines = buffer.split('\n');
        const remainder = lines.pop() ?? '';

        lines
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .forEach((line) => {
                this.applyRecipeCreationEvent(this.parseRecipeCreationEvent(line));
            });

        return remainder;
    }

    private parseRecipeCreationEvent(line: string): CreateRecipeFromImagesStreamEvent {
        try {
            return createRecipeFromImagesStreamEventSchema.parse(JSON.parse(line));
        } catch {
            throw new Error('The recipe creation service returned an invalid progress event.');
        }
    }

    private applyRecipeCreationEvent(event: CreateRecipeFromImagesStreamEvent) {
        this.creationMilestones.update((current) => {
            const nextMilestones: CreateRecipeFromImagesStreamResult = { ...(current ?? {}) };

            if (event.type === 'status') {
                const milestoneKey = progressStageToMilestoneKey[event.stage];
                nextMilestones[milestoneKey] = true;
                return nextMilestones;
            }

            if (event.type === 'result') {
                nextMilestones.recipeId = event.recipeId;
                return nextMilestones;
            }

            nextMilestones.error = event.message;
            return nextMilestones;
        });
    }

    private hasRecipeCreationCompleted() {
        const milestones = this.creationMilestones();
        return milestones?.recipeId !== undefined || milestones?.error !== undefined;
    }

    private async getRecipeCreationErrorMessage(response: Response) {
        const fallbackMessage = 'We could not create a recipe from these photos. Please try again.';
        const responseText = await response.text();

        if (!responseText) {
            return fallbackMessage;
        }

        try {
            const parsedResponse = z.object({ error: z.string().optional() }).parse(JSON.parse(responseText));
            return parsedResponse.error || fallbackMessage;
        } catch {
            return responseText;
        }
    }
}
