import { Component, inject } from '@angular/core';
import { ChatViewModeService } from '../../../services/chat-view-mode.service';

@Component({
    selector: 'app-chat-mode-toggle',
    templateUrl: './chat-mode-toggle.html',
})
export class ChatModeToggle {
    protected readonly viewModeService = inject(ChatViewModeService);

    toggle(): void {
        this.viewModeService.toggle();
    }
}
