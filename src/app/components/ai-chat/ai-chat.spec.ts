import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { vi } from 'vitest';
import { AiChat } from './ai-chat';
import { ChatContextService } from '../../services/chat-context.service';
import { ChatViewModeService } from '../../services/chat-view-mode.service';
import { ImageUploadService } from '../../services/image-upload.service';

function createSseResponse(events: unknown[]): Response {
    const encoder = new TextEncoder();
    const payload = `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(payload));
            controller.close();
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
        },
    });
}

async function waitFor(assertion: () => void, timeoutMs = 1500): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            assertion();
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    }

    assertion();
}

describe('AiChat pending response loader', () => {
    let fixture: ComponentFixture<AiChat>;
    let component: AiChat;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AiChat],
            providers: [
                provideMarkdown(),
                {
                    provide: ImageUploadService,
                    useValue: {
                        uploadWithProgress: vi.fn(),
                        createPreviewUrl: vi.fn(),
                        revokePreviewUrl: vi.fn(),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AiChat);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        fixture.destroy();
    });

    function setMessages(messages: unknown[]): void {
        const chat = component.chat as unknown as { messages: unknown[] };
        chat.messages.length = 0;
        chat.messages.push(...messages);
    }

    function shouldShowPendingLoader(isChatLoading: boolean): boolean {
        return (
            component as unknown as {
                shouldShowPendingResponseLoader: (loading: boolean) => boolean;
            }
        ).shouldShowPendingResponseLoader(isChatLoading);
    }

    it('shows the pending loader while the last message is still the user turn', () => {
        setMessages([{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Need pasta ideas' }] }]);

        expect(shouldShowPendingLoader(true)).toBe(true);
    });

    it('shows the pending loader for assistant tool input without visible UI yet', () => {
        setMessages([
            {
                id: 'assistant-1',
                role: 'assistant',
                parts: [{ type: 'tool-getRecipeDetail', state: 'input-available' }],
            },
        ]);

        expect(shouldShowPendingLoader(true)).toBe(true);
    });

    it('hides the pending loader once assistant text is visible', () => {
        setMessages([
            { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Here are the ingredients.' }] },
        ]);

        expect(shouldShowPendingLoader(true)).toBe(false);
    });

    it('hides the pending loader when a tool already renders visible loading UI', () => {
        setMessages([
            { id: 'assistant-1', role: 'assistant', parts: [{ type: 'tool-findRecipe', state: 'input-available' }] },
        ]);

        expect(shouldShowPendingLoader(true)).toBe(false);
    });

    it('hides the pending loader when the chat is no longer loading', () => {
        setMessages([{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Need pasta ideas' }] }]);

        expect(shouldShowPendingLoader(false)).toBe(false);
    });
});

describe('AiChat recipe context chip', () => {
    let fixture: ComponentFixture<AiChat>;
    let chatContextService: ChatContextService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AiChat],
            providers: [
                provideMarkdown(),
                {
                    provide: ImageUploadService,
                    useValue: {
                        uploadWithProgress: vi.fn(),
                        createPreviewUrl: vi.fn(),
                        revokePreviewUrl: vi.fn(),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AiChat);
        chatContextService = TestBed.inject(ChatContextService);
    });

    afterEach(() => {
        chatContextService.clearRecipeContext();
        fixture.destroy();
    });

    it('shows the active recipe title above the composer', () => {
        chatContextService.setRecipeContext('recipe-1', 'Creamy Tomato Pasta');
        TestBed.inject(ChatViewModeService).setOpen(true);

        fixture.detectChanges();

        const chip = fixture.nativeElement.querySelector('[data-testid="context-recipe-chip"]') as HTMLElement | null;

        expect(chip).not.toBeNull();
        expect(chip?.textContent).toContain('Creamy Tomato Pasta');
    });
});

describe('AiChat starter suggestions', () => {
    let fixture: ComponentFixture<AiChat>;
    let component: AiChat;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AiChat],
            providers: [
                provideMarkdown(),
                {
                    provide: ImageUploadService,
                    useValue: {
                        uploadWithProgress: vi.fn(),
                        createPreviewUrl: vi.fn(),
                        revokePreviewUrl: vi.fn(),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AiChat);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        fixture.destroy();
    });

    function setMessages(messages: unknown[]): void {
        const chat = component.chat as unknown as { messages: unknown[] };
        chat.messages.length = 0;
        chat.messages.push(...messages);
    }

    it('shows suggestions for a fresh conversation', () => {
        setMessages([{ id: 'welcome', role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] }]);

        expect(component.shouldShowSuggestions()).toBe(true);
    });

    it('hides suggestions after the user has sent a message', () => {
        setMessages([
            { id: 'welcome', role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] },
            { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Need pasta ideas' }] },
        ]);

        expect(component.shouldShowSuggestions()).toBe(false);
    });

    it('renders collection and creation starters in the UI', () => {
        TestBed.inject(ChatViewModeService).setOpen(true);
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain('Search recipes in your collection or create something brand new.');
        expect(text).toContain('Show soup recipes');
        expect(text).toContain('Create a brownie recipe');
    });

    it('sends a suggestion prompt when clicked', () => {
        const sendMessageSpy = vi.spyOn(component, 'sendMessage').mockImplementation(() => undefined);

        component.sendSuggestion('Create a brownie recipe with ingredients and step-by-step instructions.');

        expect(component.inputMessage()).toBe(
            'Create a brownie recipe with ingredients and step-by-step instructions.',
        );
        expect(sendMessageSpy).toHaveBeenCalled();
    });

    it('renders user messages without a leading space', () => {
        TestBed.inject(ChatViewModeService).setOpen(true);
        setMessages([
            { id: 'welcome', role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] },
            { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Need pasta ideas' }] },
        ]);

        fixture.detectChanges();

        const message = fixture.nativeElement.querySelector('[data-message-id="user-1"] p') as HTMLElement | null;

        expect(message).not.toBeNull();
        expect(message?.textContent).toBe('Need pasta ideas');
    });

    it('starts a new conversation from the header trash button', () => {
        TestBed.inject(ChatViewModeService).setOpen(true);
        setMessages([
            { id: 'welcome', role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] },
            { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Need pasta ideas' }] },
            { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Here are a few ideas.' }] },
        ]);
        component.inputMessage.set('draft follow-up');

        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector(
            '[data-testid="new-conversation-button"]',
        ) as HTMLButtonElement | null;

        expect(button).not.toBeNull();
        expect(button?.disabled).toBe(false);

        button?.click();
        fixture.detectChanges();

        const chat = component.chat as unknown as { messages: Array<{ id?: string; role?: string }> };

        expect(component.inputMessage()).toBe('');
        expect(chat.messages).toHaveLength(1);
        expect(chat.messages[0]?.id).toBe('welcome');
        expect(chat.messages[0]?.role).toBe('assistant');
        expect(component.shouldShowSuggestions()).toBe(true);
    });
});

describe('AiChat findRecipe rendering', () => {
    let fixture: ComponentFixture<AiChat>;
    let component: AiChat;
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AiChat],
            providers: [
                provideRouter([]),
                provideMarkdown(),
                {
                    provide: ImageUploadService,
                    useValue: {
                        uploadWithProgress: vi.fn(),
                        createPreviewUrl: vi.fn(),
                        revokePreviewUrl: vi.fn(),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AiChat);
        component = fixture.componentInstance;
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        fixture.destroy();
    });

    it('renders soup recipe results from a completed findRecipe tool output', () => {
        const chat = component.chat as unknown as { messages: unknown[] };
        chat.messages.length = 0;
        chat.messages.push({
            id: 'assistant-soup-results',
            role: 'assistant',
            parts: [
                {
                    type: 'tool-findRecipe',
                    state: 'output-available',
                    output: {
                        recipes: [
                            {
                                id: '33333333-3333-3333-3333-333333333333',
                                title: 'Classic Tomato Soup',
                                description: 'Velvety smooth tomato soup with fresh basil.',
                                imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
                                category: 'Soups',
                                similarity: 0.440050423145294,
                            },
                            {
                                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                                title: 'Hearty Minestrone Soup',
                                description: 'Italian vegetable soup with beans and pasta.',
                                imageUrl: 'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=800',
                                category: 'Soups',
                                similarity: 0.42,
                            },
                        ],
                    },
                },
            ],
        });

        TestBed.inject(ChatViewModeService).setOpen(true);

        expect(() => fixture.detectChanges()).not.toThrow();

        const text = fixture.nativeElement.textContent as string;
        const recipeCards = fixture.nativeElement.querySelectorAll('app-chat-recipe-card');

        expect(recipeCards.length).toBe(2);
        expect(text).toContain('Classic Tomato Soup');
        expect(text).toContain('Hearty Minestrone Soup');
        expect(text).toContain('44% match');
        expect(text).toContain('42% match');
    });

    it('parses and renders streamed soup results when a starter suggestion is sent', async () => {
        fetchSpy.mockResolvedValue(
            createSseResponse([
                { type: 'start' },
                { type: 'start-step' },
                {
                    type: 'tool-input-available',
                    toolCallId: 'call-soup',
                    toolName: 'findRecipe',
                    input: { searchQuery: 'soup', category: 'Soups', maxTime: null, matchCount: 3 },
                },
                {
                    type: 'tool-output-available',
                    toolCallId: 'call-soup',
                    output: {
                        recipes: [
                            {
                                id: '33333333-3333-3333-3333-333333333333',
                                title: 'Classic Tomato Soup',
                                description: 'Velvety smooth tomato soup with fresh basil.',
                                imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
                                category: 'Soups',
                                similarity: 0.440050423145294,
                            },
                            {
                                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                                title: 'Hearty Minestrone Soup',
                                description: 'Italian vegetable soup with beans and pasta.',
                                imageUrl: 'https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=800',
                                category: 'Soups',
                                similarity: 0.42,
                            },
                        ],
                    },
                },
                { type: 'finish-step' },
                { type: 'start-step' },
                { type: 'text-start', id: 'msg-soup' },
                { type: 'text-end', id: 'msg-soup' },
                { type: 'finish-step' },
                { type: 'finish', finishReason: 'stop' },
            ]),
        );

        TestBed.inject(ChatViewModeService).setOpen(true);
        fixture.detectChanges();

        component.sendSuggestion('Show me some soup recipes from my collection.');

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalled();
            expect(component.chat.status).toBe('ready');
        });

        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;
        const recipeCards = fixture.nativeElement.querySelectorAll('app-chat-recipe-card');

        expect(fetchSpy).toHaveBeenCalled();
        expect(recipeCards.length).toBe(2);
        expect(text).toContain('Classic Tomato Soup');
        expect(text).toContain('Hearty Minestrone Soup');
        expect(text).toContain('44% match');
        expect(text).toContain('42% match');
    });
});
