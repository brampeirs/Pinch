import { Injectable, signal, computed } from '@angular/core';

export type ChatViewMode = 'floating' | 'sidebar';

const STORAGE_KEY = 'chat-view-mode';

@Injectable({
    providedIn: 'root',
})
export class ChatViewModeService {
    private readonly _mode = signal<ChatViewMode>(this.loadFromStorage());
    private readonly _isOpen = signal(false);

    /** Current chat view mode */
    readonly mode = this._mode.asReadonly();

    /** Whether the chat panel is open */
    readonly isOpen = this._isOpen.asReadonly();

    /** Whether the chat is in sidebar mode */
    readonly isSidebar = computed(() => this._mode() === 'sidebar');

    /** Whether the chat is in floating mode */
    readonly isFloating = computed(() => this._mode() === 'floating');

    /** Whether the sidebar layout should be applied (sidebar mode AND chat is open) */
    readonly isSidebarActive = computed(() => this._mode() === 'sidebar' && this._isOpen());

    /** Toggle between floating and sidebar modes */
    toggle(): void {
        const newMode = this._mode() === 'floating' ? 'sidebar' : 'floating';
        this.setMode(newMode);
    }

    /** Set the chat view mode */
    setMode(mode: ChatViewMode): void {
        this._mode.set(mode);
        this.saveToStorage(mode);
    }

    /** Set the chat open state (called by AiChat component) */
    setOpen(isOpen: boolean): void {
        this._isOpen.set(isOpen);
    }

    private loadFromStorage(): ChatViewMode {
        if (typeof localStorage === 'undefined') {
            return 'floating';
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'sidebar' ? 'sidebar' : 'floating';
    }

    private saveToStorage(mode: ChatViewMode): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, mode);
        }
    }
}
