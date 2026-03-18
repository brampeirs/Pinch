import { Injectable, signal } from '@angular/core';

/**
 * Service to share context between pages and the global chat component.
 * Pages can set context (e.g., current recipe ID) that the chat uses.
 */
@Injectable({
    providedIn: 'root',
})
export class ChatContextService {
    /** The ID of the recipe the user is currently viewing (if any) */
    readonly contextRecipeId = signal<string | null>(null);

    /**
     * Set the current recipe context.
     * Call this when navigating to a recipe detail page.
     */
    setRecipeContext(recipeId: string | null): void {
        this.contextRecipeId.set(recipeId);
    }

    /**
     * Clear the recipe context.
     * Call this when leaving a recipe detail page.
     */
    clearRecipeContext(): void {
        this.contextRecipeId.set(null);
    }
}

