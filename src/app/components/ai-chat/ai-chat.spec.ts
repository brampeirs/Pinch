import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiChat } from './ai-chat';
import { ImageUploadService } from '../../services/image-upload.service';

describe('AiChat pending response loader', () => {
    let fixture: ComponentFixture<AiChat>;
    let component: AiChat;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AiChat],
            providers: [
                {
                    provide: ImageUploadService,
                    useValue: {
                        uploadWithProgress: jasmine.createSpy('uploadWithProgress'),
                        createPreviewUrl: jasmine.createSpy('createPreviewUrl'),
                        revokePreviewUrl: jasmine.createSpy('revokePreviewUrl'),
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

        expect(shouldShowPendingLoader(true)).toBeTrue();
    });

    it('shows the pending loader for assistant tool input without visible UI yet', () => {
        setMessages([{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'tool-getRecipeDetail', state: 'input-available' }] }]);

        expect(shouldShowPendingLoader(true)).toBeTrue();
    });

    it('hides the pending loader once assistant text is visible', () => {
        setMessages([{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Here are the ingredients.' }] }]);

        expect(shouldShowPendingLoader(true)).toBeFalse();
    });

    it('hides the pending loader when a tool already renders visible loading UI', () => {
        setMessages([{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'tool-findRecipe', state: 'input-available' }] }]);

        expect(shouldShowPendingLoader(true)).toBeFalse();
    });

    it('hides the pending loader when the chat is no longer loading', () => {
        setMessages([{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Need pasta ideas' }] }]);

        expect(shouldShowPendingLoader(false)).toBeFalse();
    });
});