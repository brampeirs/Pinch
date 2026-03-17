import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getDisplayImage } from '../../../utils/placeholder';

/** Recipe data structure from the findRecipe tool */
export interface ChatRecipe {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category?: string;
  similarity: number;
}

@Component({
  selector: 'app-chat-recipe-card',
  imports: [RouterLink],
  templateUrl: './chat-recipe-card.html',
})
export class ChatRecipeCard {
  recipe = input.required<ChatRecipe>();

  /** Returns the image URL or a category-specific placeholder */
  displayImage = computed(() => {
    const r = this.recipe();
    return getDisplayImage(r.imageUrl, r.category || '');
  });
}

