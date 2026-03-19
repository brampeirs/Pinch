import { Injectable, signal } from '@angular/core';

/**
 * Service to share context between pages and the global chat component.
 * Pages can set context (e.g., current recipe ID) that the chat uses.
 */
@Injectable({
    providedIn: 'root',
})
export class ChatContextService {
    private readonly _contextRecipeId = signal<string | null>(null);
    private readonly _contextRecipeTitle = signal<string | null>(null);

    /** The ID of the recipe the user is currently viewing (if any) */
    readonly contextRecipeId = this._contextRecipeId.asReadonly();

    /** The title of the recipe the user is currently viewing (if any) */
    readonly contextRecipeTitle = this._contextRecipeTitle.asReadonly();

    /**
     * Set the current recipe context.
     * Call this when navigating to a recipe detail page.
     */
    setRecipeContext(recipeId: string | null, recipeTitle: string | null = null): void {
        this._contextRecipeId.set(recipeId);
        this._contextRecipeTitle.set(recipeId ? recipeTitle : null);
    }

    /**
     * Clear the recipe context.
     * Call this when leaving a recipe detail page.
     */
    clearRecipeContext(): void {
        this._contextRecipeId.set(null);
        this._contextRecipeTitle.set(null);
    }
}
