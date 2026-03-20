import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { ImageUploadService } from '../../services/image-upload.service';
import { SupabaseService } from '../../services/supabase.service';
import { UploadRecipePhotosPage } from './upload-recipe-photos';

function createFile(name: string, type: string, size: number = 2048) {
    return new File([new Uint8Array(size)], name, { type });
}

function createFileSelectionEvent(files: File[]): Event {
    return {
        target: {
            files,
            value: 'mock-selection',
        },
    } as unknown as Event;
}

function createFileDropEvent(files: File[]): DragEvent {
    return {
        preventDefault: vi.fn(),
        dataTransfer: {
            files,
        },
    } as unknown as DragEvent;
}

function createDeferred<T>() {
    let resolve!: (value: T) => void;

    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

function createProgressEventLine(event: unknown) {
    return `${JSON.stringify(event)}\n`;
}

function createRecipeCreationStreamResponse(chunks: string[]) {
    const encoder = new TextEncoder();

    return new Response(
        new ReadableStream({
            start(controller) {
                chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
                controller.close();
            },
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/x-ndjson; charset=utf-8',
            },
        },
    );
}

function createDeferredRecipeCreationStream() {
    const encoder = new TextEncoder();
    const transformStream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = transformStream.writable.getWriter();

    const response = new Response(transformStream.readable, {
        status: 200,
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
        },
    });

    return {
        response,
        async push(chunk: string) {
            await writer.write(encoder.encode(chunk));
        },
        async close() {
            try {
                await writer.close();
            } catch (error) {
                if (!(error instanceof TypeError)) {
                    throw error;
                }
            }
        },
    };
}

describe('UploadRecipePhotosPage', () => {
    let fixture: ComponentFixture<UploadRecipePhotosPage>;
    let component: UploadRecipePhotosPage;
    let router: Router;
    const imageUploadService = {
        uploadWithProgress: vi.fn(),
        createPreviewUrl: vi.fn(),
        revokePreviewUrl: vi.fn(),
    };
    const supabaseService = {
        createRecipeFromImagesStreamFetch: vi.fn(),
    };

    beforeEach(async () => {
        imageUploadService.uploadWithProgress.mockReset();
        imageUploadService.createPreviewUrl.mockReset();
        imageUploadService.revokePreviewUrl.mockReset();
        supabaseService.createRecipeFromImagesStreamFetch.mockReset();

        imageUploadService.createPreviewUrl.mockImplementation((file) => `blob:${(file as File).name}`);
        imageUploadService.revokePreviewUrl.mockImplementation(() => undefined);
        imageUploadService.uploadWithProgress.mockImplementation(
            async (file: File, onProgress: (percent: number) => void) => {
                onProgress(100);
                return { url: `https://cdn.test/${file.name}`, error: null };
            },
        );
        supabaseService.createRecipeFromImagesStreamFetch.mockResolvedValue(
            createRecipeCreationStreamResponse([
                createProgressEventLine({ type: 'status', stage: 'images_received' }),
                createProgressEventLine({ type: 'status', stage: 'analyzing_images' }),
                createProgressEventLine({ type: 'status', stage: 'extracting_recipe' }),
                createProgressEventLine({ type: 'status', stage: 'saving_recipe' }),
                createProgressEventLine({ type: 'result', recipeId: 'recipe-123' }),
            ]),
        );

        await TestBed.configureTestingModule({
            imports: [UploadRecipePhotosPage],
            providers: [
                provideRouter([]),
                { provide: ImageUploadService, useValue: imageUploadService },
                { provide: SupabaseService, useValue: supabaseService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(UploadRecipePhotosPage);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        vi.spyOn(router, 'navigate').mockResolvedValue(true);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('renders a large empty-state upload surface before any image is selected', () => {
        const element = fixture.nativeElement as HTMLElement;

        expect(element.textContent).toContain('Create a recipe from photos');
        expect(element.textContent).toContain('Upload a few clear photos to get started.');
        expect(element.textContent).toContain('Drop photos here');
        expect(element.textContent).toContain('or click to browse');
        expect(element.textContent).toContain('JPG, PNG, WebP');
        expect(element.textContent).not.toContain('Photos');
        expect(element.textContent).not.toContain('No photos selected yet');
        expect(element.textContent).not.toContain('What happens next');
        expect(element.textContent).not.toContain('Create recipe');
    });

    it('accepts supported images dropped onto the upload area and uploads them immediately', async () => {
        component.onFilesDropped(createFileDropEvent([createFile('page-1.jpg', 'image/jpeg')]));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(component.selectedImages()).toHaveLength(1);
        expect(imageUploadService.uploadWithProgress).toHaveBeenCalledTimes(1);
        expect(component.selectedImages()[0].status).toBe('completed');
        expect(component.selectedImages()[0].publicUrl).toBe('https://cdn.test/page-1.jpg');
        expect(component.canCreateDraft()).toBe(true);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Photos');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 photo selected');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('1 ready');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Upload');
        expect(component.isDragActive()).toBe(false);
    });

    it('accepts supported images across multiple selections and lets the user remove one', async () => {
        component.onFilesSelected(
            createFileSelectionEvent([createFile('page-1.jpg', 'image/jpeg'), createFile('page-2.png', 'image/png')]),
        );
        component.onFilesSelected(createFileSelectionEvent([createFile('cover.webp', 'image/webp')]));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(component.selectedImages().length).toBe(3);
        expect(imageUploadService.uploadWithProgress).toHaveBeenCalledTimes(3);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('3 photos selected');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Create recipe');

        component.removeImage(component.selectedImages()[1].id);
        fixture.detectChanges();

        expect(component.selectedImages().length).toBe(2);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 photos selected');
    });

    it('rejects HEIC files with an inline validation message', () => {
        component.onFilesSelected(createFileSelectionEvent([createFile('scan.heic', 'image/heic')]));
        fixture.detectChanges();

        expect(component.selectedImages()).toHaveLength(0);
        expect(component.validationMessage()).toContain('HEIC/HEIF');
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('HEIC/HEIF photos are not supported yet');
    });

    it('allows creation while uploads are still in progress and waits to create until they settle', async () => {
        const deferredUpload = createDeferred<{ url: string | null; error: string | null }>();
        imageUploadService.uploadWithProgress.mockImplementationOnce(
            async (_file: File, onProgress: (percent: number) => void) => {
                onProgress(42);
                return deferredUpload.promise;
            },
        );

        component.onFilesSelected(createFileSelectionEvent([createFile('recipe.jpg', 'image/jpeg')]));
        fixture.detectChanges();

        expect(component.selectedImages()).toHaveLength(1);
        expect(component.selectedImages()[0].status).toBe('uploading');
        expect(component.selectedImages()[0].progress).toBe(42);
        expect(component.canCreateDraft()).toBe(true);

        const createPromise = component.createDraftPreview();
        fixture.detectChanges();

        expect(component.creationState()).toBe('creating');
        expect(supabaseService.createRecipeFromImagesStreamFetch).not.toHaveBeenCalled();
        expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Select recipe photos"]')).toBeNull();

        deferredUpload.resolve({ url: 'https://cdn.test/recipe.jpg', error: null });
        await createPromise;
        await flushPromises();
        fixture.detectChanges();

        expect(supabaseService.createRecipeFromImagesStreamFetch).toHaveBeenCalledTimes(1);
        expect(supabaseService.createRecipeFromImagesStreamFetch.mock.calls[0][0]).toBe('create-recipe-from-images');
        expect(JSON.parse(supabaseService.createRecipeFromImagesStreamFetch.mock.calls[0][1].body as string)).toEqual({
            images: [{ url: 'https://cdn.test/recipe.jpg', mediaType: 'image/jpeg' }],
        });
        expect(router.navigate).toHaveBeenCalledWith(['/recipes', 'recipe-123']);
    });

    it('updates the visible creation stages from streamed backend milestones', async () => {
        const stream = createDeferredRecipeCreationStream();
        supabaseService.createRecipeFromImagesStreamFetch.mockResolvedValueOnce(stream.response);

        component.onFilesSelected(createFileSelectionEvent([createFile('recipe.jpg', 'image/jpeg')]));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const createPromise = component.createDraftPreview();
        await flushPromises();
        fixture.detectChanges();

        expect(component.creationStages()[0].status).toBe('active');

        await stream.push(
            [
                createProgressEventLine({ type: 'status', stage: 'images_received' }),
                createProgressEventLine({ type: 'status', stage: 'analyzing_images' }),
                createProgressEventLine({ type: 'status', stage: 'extracting_recipe' }),
                createProgressEventLine({ type: 'status', stage: 'choosing_cover' }),
                createProgressEventLine({ type: 'status', stage: 'saving_recipe' }),
                createProgressEventLine({ type: 'result', recipeId: 'recipe-123' }),
            ].join(''),
        );
        await flushPromises();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(component.creationStages()[0].status).toBe('complete');
        expect(component.creationStages()[1].status).toBe('complete');
        expect(component.creationStages()[2].status).toBe('complete');
        expect(component.creationStages()[3].status).toBe('complete');
        await createPromise;
        await flushPromises();
        fixture.detectChanges();

        expect(router.navigate).toHaveBeenCalledWith(['/recipes', 'recipe-123']);

        await stream.close();
    });

    it('shows a retry action for failed uploads and completes the retry successfully', async () => {
        imageUploadService.uploadWithProgress
            .mockImplementationOnce(async (_file: File, onProgress: (percent: number) => void) => {
                onProgress(35);
                return { url: null, error: 'Upload failed: 500' };
            })
            .mockImplementationOnce(async (file: File, onProgress: (percent: number) => void) => {
                onProgress(100);
                return { url: `https://cdn.test/${file.name}`, error: null };
            });

        component.onFilesSelected(createFileSelectionEvent([createFile('recipe.jpg', 'image/jpeg')]));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(component.selectedImages()[0].status).toBe('error');
        expect(component.selectedImages()[0].error).toBe('Upload failed: 500');
        expect(
            (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Retry upload for recipe.jpg"]'),
        ).not.toBeNull();

        component.retryUpload(component.selectedImages()[0].id);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(imageUploadService.uploadWithProgress).toHaveBeenCalledTimes(2);
        expect(component.selectedImages()[0].status).toBe('completed');
        expect(component.selectedImages()[0].publicUrl).toBe('https://cdn.test/recipe.jpg');
    });

    it('shows an inline error when every upload fails after the user already started creating', async () => {
        const deferredUpload = createDeferred<{ url: string | null; error: string | null }>();
        imageUploadService.uploadWithProgress.mockImplementationOnce(
            async (_file: File, onProgress: (percent: number) => void) => {
                onProgress(55);
                return deferredUpload.promise;
            },
        );

        component.onFilesSelected(createFileSelectionEvent([createFile('recipe.jpg', 'image/jpeg')]));
        fixture.detectChanges();

        const createPromise = component.createDraftPreview();
        fixture.detectChanges();

        expect(component.creationState()).toBe('creating');
        deferredUpload.resolve({ url: null, error: 'Upload failed: 500' });
        await createPromise;
        await flushPromises();
        fixture.detectChanges();

        expect(component.creationState()).toBe('idle');
        expect(component.validationMessage()).toContain('At least one photo needs to upload successfully');
        expect(supabaseService.createRecipeFromImagesStreamFetch).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('shows an inline error when recipe creation fails after uploads complete', async () => {
        supabaseService.createRecipeFromImagesStreamFetch.mockResolvedValueOnce(
            createRecipeCreationStreamResponse([
                createProgressEventLine({ type: 'status', stage: 'images_received' }),
                createProgressEventLine({ type: 'error', message: 'AI service unavailable' }),
            ]),
        );

        component.onFilesSelected(createFileSelectionEvent([createFile('recipe.jpg', 'image/jpeg')]));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        await component.createDraftPreview();
        await flushPromises();
        fixture.detectChanges();

        expect(component.creationState()).toBe('idle');
        expect(component.validationMessage()).toContain('AI service unavailable');
        expect(router.navigate).not.toHaveBeenCalled();
    });
});
