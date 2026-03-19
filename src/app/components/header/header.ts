import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChatViewModeService } from '../../services/chat-view-mode.service';

@Component({
    selector: 'app-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, RouterLinkActive],
    templateUrl: './header.html',
    styleUrl: './header.scss',
})
export class Header {
    private readonly chatViewModeService = inject(ChatViewModeService);

    isSearchOpen = signal(false);
    isMenuOpen = signal(false);

    toggleSearch() {
        this.isSearchOpen.update((v) => !v);
    }

    toggleMenu() {
        this.isMenuOpen.update((v) => !v);
    }

    toggleAiChat() {
        this.chatViewModeService.toggleOpen();
    }
}
