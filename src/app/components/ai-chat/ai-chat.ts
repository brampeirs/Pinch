import { Component, signal, computed, ElementRef, ViewChild } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-ai-chat',
  templateUrl: './ai-chat.html',
  styleUrl: './ai-chat.scss',
})
export class AiChat {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  isOpen = signal(false);
  isLoading = signal(false);
  inputMessage = signal('');
  messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hoi! 👋 Ik ben je kook-assistent. Vertel me welke ingrediënten je hebt en ik help je een lekker recept te vinden!',
      timestamp: new Date(),
    },
  ]);

  // Mock recipe suggestions based on ingredients
  private recipeDatabase = [
    { ingredients: ['tomaat', 'komkommer', 'ui'], recipe: 'Griekse Salade', description: 'Voeg feta en olijven toe voor een klassieke Griekse salade!' },
    { ingredients: ['pasta', 'tomaat', 'knoflook'], recipe: 'Pasta Pomodoro', description: 'Simpel maar heerlijk! Bak de knoflook in olijfolie, voeg tomaten toe en serveer over pasta.' },
    { ingredients: ['kip', 'rijst', 'groenten'], recipe: 'Kip Teriyaki Bowl', description: 'Bak de kip met teriyakisaus en serveer over rijst met groenten.' },
    { ingredients: ['ei', 'avocado', 'brood'], recipe: 'Avocado Toast', description: 'Toast het brood, beleg met gepureerde avocado en top met een gebakken ei.' },
    { ingredients: ['aardappel', 'ui', 'kaas'], recipe: 'Aardappelgratin', description: 'Schijf de aardappelen, laag met ui en kaas, bak in de oven tot goudbruin.' },
    { ingredients: ['spinazie', 'ei', 'kaas'], recipe: 'Spinazie Omelet', description: 'Klop de eieren, voeg spinazie en kaas toe, bak tot stevig.' },
  ];

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

    // Simulate AI response delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Generate response
    const response = this.generateResponse(message);
    this.messages.update((msgs) => [
      ...msgs,
      { role: 'assistant', content: response, timestamp: new Date() },
    ]);
    this.isLoading.set(false);

    // Scroll to bottom
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private generateResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    // Extract ingredients from message
    const foundIngredients: string[] = [];
    const allIngredients = ['tomaat', 'komkommer', 'ui', 'pasta', 'knoflook', 'kip', 'rijst', 'groenten', 'ei', 'avocado', 'brood', 'aardappel', 'kaas', 'spinazie'];

    for (const ingredient of allIngredients) {
      if (lowerMessage.includes(ingredient)) {
        foundIngredients.push(ingredient);
      }
    }

    if (foundIngredients.length > 0) {
      // Find matching recipes
      const matches = this.recipeDatabase.filter((r) =>
        r.ingredients.some((i) => foundIngredients.includes(i))
      );

      if (matches.length > 0) {
        const recipe = matches[Math.floor(Math.random() * matches.length)];
        return `Met ${foundIngredients.join(', ')} kun je **${recipe.recipe}** maken! 🍽️\n\n${recipe.description}\n\nWil je meer receptideeën of heb je andere ingrediënten?`;
      }
    }

    // Default responses
    const defaultResponses = [
      'Vertel me welke ingrediënten je in huis hebt, dan zoek ik een passend recept voor je! 🥕',
      'Wat voor soort gerecht heb je zin in? Ik kan je helpen met pasta, salades, soepen en meer!',
      'Heb je specifieke dieetwensen? Ik kan ook vegetarische of glutenvrije recepten voorstellen.',
    ];

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
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

