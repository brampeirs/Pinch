import { Component, signal, ElementRef, ViewChild, effect, inject, HostListener } from '@angular/core';
import { Chat } from '@ai-sdk/angular';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MarkdownComponent } from 'ngx-markdown';
import { environment } from '../../../environments/environment';
import { ChatViewModeService } from '../../services/chat-view-mode.service';
import { ChatModeToggle } from './chat-mode-toggle/chat-mode-toggle';
import { ChatRecipeCard, ChatRecipe } from './chat-recipe-card/chat-recipe-card';

// Mobile breakpoint (matches Tailwind's 'md')
const MOBILE_BREAKPOINT = 768;

// Re-export for backward compatibility
export type RecipeResult = ChatRecipe;

// Track reasoning state for auto-open/close
interface ReasoningState {
    wasStreaming: boolean;
    isOpen: boolean;
    autoCloseTimer?: ReturnType<typeof setTimeout>;
}

@Component({
    selector: 'app-ai-chat',
    templateUrl: './ai-chat.html',
    styleUrl: './ai-chat.scss',
    imports: [MarkdownComponent, ChatModeToggle, ChatRecipeCard],
})
export class AiChat {
    @ViewChild('messagesContainer') messagesContainer!: ElementRef;
    @ViewChild('textareaInput') textareaInput!: ElementRef<HTMLTextAreaElement>;

    protected readonly viewModeService = inject(ChatViewModeService);

    // Chat instance from @ai-sdk/angular with transport configuration
    public chat = new Chat({
        transport: new DefaultChatTransport({
            api: `${environment.supabase.url}/functions/v1/chat`,
            headers: {
                'Content-Type': 'application/json',
            },
        }),
        // Use 'messages' (not 'initialMessages') for initial state
        messages: [
            {
                id: 'welcome',
                role: 'assistant' as const,
                parts: [
                    {
                        type: 'text' as const,
                        text: "Hi! 👋 I'm your cooking assistant. Tell me what you want to make or what ingredients you have, and I'll find the best recipes for you!",
                    },
                ],
            },
        ],
    });

    isOpen = signal(false);
    inputMessage = signal('');
    autoScrollEnabled = signal(true);
    showJumpToLatest = signal(false);

    // Mobile detection
    isMobile = signal(typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);

    private readonly bottomSnapThreshold = 72;
    private alignNextResponseToTop = false;
    private latestUserMessageId: string | null = null;

    // Track reasoning open/close state per message
    private reasoningStates = new Map<string, ReasoningState>();
    private previousReasoningStreaming = new Map<string, boolean>();

    @HostListener('window:resize')
    onResize() {
        this.isMobile.set(window.innerWidth < MOBILE_BREAKPOINT);
    }

    constructor() {
        // Auto-scroll only when user is near the bottom or when we intentionally align a new turn.
        effect(() => {
            if (this.chat.messages.length === 0) {
                return;
            }

            setTimeout(() => {
                if (this.alignNextResponseToTop && this.latestUserMessageId) {
                    this.scrollMessageToTop(this.latestUserMessageId);
                    this.updateScrollState();
                    return;
                }

                if (this.autoScrollEnabled()) {
                    this.scrollToBottom();
                }

                this.updateScrollState();
            }, 40);

            if (!this.isLoading) {
                this.alignNextResponseToTop = false;
                this.latestUserMessageId = null;
                if (this.isNearBottom()) {
                    this.autoScrollEnabled.set(true);
                }
            }
        });
    }

    // Getters for template binding
    get messages(): UIMessage[] {
        // Process reasoning states for auto-open/close
        this.chat.messages.forEach((msg) => {
            msg.parts?.forEach((p, partIndex) => {
                const part = p as any;
                if (part.type === 'reasoning') {
                    const key = `${msg.id}-${partIndex}`;
                    const isStreaming = part.state === 'streaming';
                    const wasStreaming = this.previousReasoningStreaming.get(key) ?? false;

                    // Initialize state if not exists
                    if (!this.reasoningStates.has(key)) {
                        this.reasoningStates.set(key, {
                            wasStreaming: false,
                            isOpen: isStreaming, // Start open if streaming
                        });
                    }

                    const state = this.reasoningStates.get(key)!;

                    // Auto-open when streaming starts
                    if (isStreaming && !wasStreaming) {
                        state.isOpen = true;
                        state.wasStreaming = true;
                    }

                    // Auto-close 1 second after streaming ends
                    if (!isStreaming && wasStreaming && state.isOpen) {
                        // Clear any existing timer
                        if (state.autoCloseTimer) {
                            clearTimeout(state.autoCloseTimer);
                        }
                        // Set new auto-close timer
                        state.autoCloseTimer = setTimeout(() => {
                            state.isOpen = false;
                        }, 1000);
                    }

                    this.previousReasoningStreaming.set(key, isStreaming);
                }
            });
        });

        return this.chat.messages;
    }

    get isLoading(): boolean {
        return this.chat.status === 'streaming' || this.chat.status === 'submitted';
    }

    // Check if we're waiting for an assistant response (last message is from user)
    private get isWaitingForResponse(): boolean {
        const messages = this.chat.messages;
        if (messages.length === 0) return false;
        const lastMessage = messages[messages.length - 1] as any;
        return lastMessage.role === 'user';
    }

    // Get the last assistant message parts for loading state checks
    // Returns empty array if we're waiting for a new response
    private get lastAssistantMessageParts(): any[] {
        // If the last message is from user, we're waiting for a NEW assistant response
        // so return empty array (no parts yet for the upcoming response)
        if (this.isWaitingForResponse) {
            return [];
        }

        const messages = this.chat.messages;
        // Find the last assistant message
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                return messages[i].parts ?? [];
            }
        }
        return [];
    }

    // Check if recipe search tools are currently loading
    get isRecipeSearchLoading(): boolean {
        return this.lastAssistantMessageParts.some(
            (part) =>
                (part.type === 'tool-optimizeRecipeQuery' || part.type === 'tool-findRecipe') &&
                (part.state === 'input-streaming' || part.state === 'input-available'),
        );
    }

    // Check if optimizeRecipeQuery is currently running (not yet complete)
    get isOptimizeQueryLoading(): boolean {
        return this.lastAssistantMessageParts.some(
            (part) =>
                part.type === 'tool-optimizeRecipeQuery' &&
                (part.state === 'input-streaming' || part.state === 'input-available'),
        );
    }

    // Check if findRecipe is currently running (not yet complete)
    get isFindRecipeLoading(): boolean {
        return this.lastAssistantMessageParts.some(
            (part) =>
                part.type === 'tool-findRecipe' &&
                (part.state === 'input-streaming' || part.state === 'input-available'),
        );
    }

    // Check if recipe search flow has started (any tool activity)
    get isRecipeSearchInProgress(): boolean {
        return this.lastAssistantMessageParts.some(
            (part) => part.type === 'tool-optimizeRecipeQuery' || part.type === 'tool-findRecipe',
        );
    }

    // Check if createRecipe is active (suppress thinking dots during entire tool lifecycle)
    get isCreateRecipeInProgress(): boolean {
        return this.lastAssistantMessageParts.some(
            (part) =>
                part.type === 'tool-createRecipe' &&
                (part.state === 'input-streaming' ||
                    part.state === 'input-available' ||
                    part.state === 'output-available'),
        );
    }

    // Check if we have recipe search output
    get hasRecipeSearchOutput(): boolean {
        return this.lastAssistantMessageParts.some(
            (part) => part.type === 'tool-findRecipe' && part.state === 'output-available',
        );
    }

    // Check if reasoning is currently streaming
    get isReasoningActive(): boolean {
        return this.lastAssistantMessageParts.some((part) => part.type === 'reasoning' && part.state === 'streaming');
    }

    // Check if there's any reasoning part (even if done)
    get hasReasoning(): boolean {
        return this.lastAssistantMessageParts.some((part) => part.type === 'reasoning');
    }

    // Check if there's any text content in the last assistant message
    get hasTextContent(): boolean {
        return this.lastAssistantMessageParts.some((part) => part.type === 'text' && part.text?.trim().length > 0);
    }

    // Show pulsing dots immediately when user sends a message, hide when:
    // - Recipe search starts (show "Preparing/Searching..." instead)
    // - Reasoning starts (reasoning component shows "Thinking...")
    // - Text content arrives (content speaks for itself)
    // - Recipe creation starts (creating card shows its own loading state)
    get showThinking(): boolean {
        return (
            this.isLoading &&
            !this.isRecipeSearchInProgress &&
            !this.isCreateRecipeInProgress &&
            !this.hasReasoning &&
            !this.hasTextContent
        );
    }

    // Show "Preparing search..." when optimizeRecipeQuery is running
    get showPreparingSearch(): boolean {
        return this.isLoading && this.isOptimizeQueryLoading && !this.hasRecipeSearchOutput;
    }

    // Show "Searching recipes..." when findRecipe is running (after optimize is done)
    get showSearching(): boolean {
        return (
            this.isLoading && this.isFindRecipeLoading && !this.isOptimizeQueryLoading && !this.hasRecipeSearchOutput
        );
    }

    // Check if any reasoning is currently streaming in a specific message
    isReasoningStreaming(message: UIMessage): boolean {
        return message.parts?.some((p: any) => p.type === 'reasoning' && p.state === 'streaming') ?? false;
    }

    // Check if reasoning is open for a specific part
    isReasoningOpen(messageId: string, partIndex: number): boolean {
        const key = `${messageId}-${partIndex}`;
        return this.reasoningStates.get(key)?.isOpen ?? false;
    }

    // Toggle reasoning open/close
    toggleReasoning(event: Event) {
        const button = event.currentTarget as HTMLElement;
        const container = button.closest('.reasoning-container') as HTMLElement;
        if (container) {
            const isOpen = container.classList.contains('is-open');
            if (isOpen) {
                container.classList.remove('is-open');
            } else {
                container.classList.add('is-open');
            }
        }
    }

    toggleChat() {
        this.isOpen.update((v) => {
            const newValue = !v;
            this.viewModeService.setOpen(newValue);
            return newValue;
        });
    }

    updateInput(event: Event) {
        const target = event.target as HTMLTextAreaElement;
        this.inputMessage.set(target.value);
        this.resizeTextarea();
    }

    private resizeTextarea() {
        const textarea = this.textareaInput?.nativeElement;
        if (!textarea) return;

        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        // Set to scrollHeight, capped by CSS max-height
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    sendMessage() {
        const message = this.inputMessage().trim();
        if (!message || this.isLoading) return;

        this.inputMessage.set('');
        // Reset textarea height after sending
        if (this.textareaInput?.nativeElement) {
            this.textareaInput.nativeElement.style.height = 'auto';
        }

        // Use the Chat sendMessage method - it handles everything
        this.chat.sendMessage({ text: message });

        // Keep the just-sent prompt near the top of the viewport (ChatGPT-like turn framing).
        this.alignNextResponseToTop = true;
        this.autoScrollEnabled.set(false);
        this.showJumpToLatest.set(false);
        setTimeout(() => {
            let latestUserMessageId: string | null = null;
            for (let i = this.chat.messages.length - 1; i >= 0; i--) {
                const message = this.chat.messages[i] as UIMessage;
                if (message.role === 'user') {
                    latestUserMessageId = message.id;
                    break;
                }
            }

            this.latestUserMessageId = latestUserMessageId;
            if (this.latestUserMessageId) {
                this.scrollMessageToTop(this.latestUserMessageId, true);
            }
        }, 60);
    }

    onMessagesScroll() {
        this.updateScrollState();
    }

    stopMessage() {
        this.chat.stop();
    }

    jumpToLatest() {
        this.autoScrollEnabled.set(true);
        this.alignNextResponseToTop = false;
        this.showJumpToLatest.set(false);
        this.scrollToBottom(true);
    }

    private updateScrollState() {
        if (!this.messagesContainer) return;

        const isNearBottom = this.isNearBottom();
        this.showJumpToLatest.set(!isNearBottom);

        if (isNearBottom) {
            this.autoScrollEnabled.set(true);
            return;
        }

        // Respect manual browsing: once user leaves the bottom area we stop auto-follow.
        this.autoScrollEnabled.set(false);
        this.alignNextResponseToTop = false;
    }

    private scrollToBottom(smooth = false) {
        if (this.messagesContainer) {
            const el = this.messagesContainer.nativeElement;
            if (smooth) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                return;
            }
            el.scrollTop = el.scrollHeight;
        }
    }

    private scrollMessageToTop(messageId: string, smooth = false) {
        if (!this.messagesContainer) return;
        const container = this.messagesContainer.nativeElement as HTMLElement;
        const target = container.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null;
        if (!target) return;

        const top = Math.max(0, target.offsetTop - 12);
        if (smooth) {
            container.scrollTo({ top, behavior: 'smooth' });
            return;
        }
        container.scrollTop = top;
    }

    private isNearBottom(): boolean {
        if (!this.messagesContainer) return true;
        const el = this.messagesContainer.nativeElement as HTMLElement;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        return distance <= this.bottomSnapThreshold;
    }

    handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    onInputFocus() {
        // On mobile, when the keyboard opens, scroll the input into view
        // Use a delay to let the keyboard animation complete
        if (this.isMobile()) {
            setTimeout(() => {
                this.textareaInput?.nativeElement?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }, 300);
        }
    }
}
