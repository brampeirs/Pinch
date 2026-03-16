import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './components/header/header';
import { AiChat } from './components/ai-chat/ai-chat';
import { ChatViewModeService } from './services/chat-view-mode.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, AiChat],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '[class.chat-sidebar-active]': 'chatViewMode.isSidebarActive()',
  },
})
export class App {
  protected readonly chatViewMode = inject(ChatViewModeService);
}
