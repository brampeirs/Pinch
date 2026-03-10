import { Component, signal, ElementRef, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recipes?: {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    similarity: number;
  }[];
}

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.html',
  styleUrl: './ai-chat.scss',
  imports: [RouterLink],
})
export class AiChat {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  private supabase = inject(SupabaseService);

  isOpen = signal(false);
  isLoading = signal(false);
  inputMessage = signal('');
  messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! 👋 I'm your cooking assistant. Tell me what you want to make or what ingredients you have, and I'll find the best recipes for you!",
      timestamp: new Date(),
    },
  ]);

  toggleChat() {
    this.isOpen.update((v) => !v);
  }

  updateInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.inputMessage.set(target.value);
  }

  async sendMessage() {
    const message = this.inputMessage().trim();
    if (!message || this.isLoading()) return;

    // Add user message
    this.messages.update((msgs) => [
      ...msgs,
      { role: 'user', content: message, timestamp: new Date() },
    ]);
    this.inputMessage.set('');
    this.isLoading.set(true);

    // Scroll to bottom
    setTimeout(() => this.scrollToBottom(), 100);

    try {
      // Build conversation history for context (exclude recipes, only text)
      const conversationHistory = this.messages()
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      // Add current message
      conversationHistory.push({ role: 'user' as const, content: message });

      // Search for recipes using semantic search with conversation history
      const response = await this.supabase.searchRecipes(conversationHistory, 3);

      let assistantMessage: ChatMessage;

      if (response.success) {
        // Use the AI-generated message from Structured Outputs
        const aiMessage = response.message || 'Hier is wat ik voor je heb gevonden!';
        const recipes = response.results || [];

        if (recipes.length > 0) {
          assistantMessage = {
            role: 'assistant',
            content: aiMessage,
            timestamp: new Date(),
            recipes: recipes.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              image_url: r.image_url,
              similarity: r.similarity,
            })),
          };
        } else {
          // No recipes found, but still show AI message
          assistantMessage = {
            role: 'assistant',
            content: aiMessage,
            timestamp: new Date(),
          };
        }
      } else {
        assistantMessage = {
          role: 'assistant',
          content: `Oops, something went wrong. 😅 ${response.error || 'Please try again.'}`,
          timestamp: new Date(),
        };
      }

      this.messages.update((msgs) => [...msgs, assistantMessage]);
    } catch {
      this.messages.update((msgs) => [
        ...msgs,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again later.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  private scrollToBottom() {
    if (this.messagesContainer) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
