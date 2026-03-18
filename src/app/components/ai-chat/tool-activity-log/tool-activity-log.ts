import { Component, Input } from '@angular/core';

export interface ToolActivity {
    toolName: string;
    toolCallId: string;
    state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorText?: string;
}

// Map tool names to user-friendly labels
const TOOL_LABELS: Record<string, string> = {
    findRecipe: '🔍 Searching recipes',
    optimizeRecipeQuery: '⚙️ Optimizing search query',
    getRecipeDetail: '📖 Fetching recipe details',
    getCategories: '📂 Loading categories',
    createRecipe: '✨ Creating recipe',
    uploadImage: '📷 Uploading image',
};

@Component({
    selector: 'app-tool-activity-log',
    template: `
        @if (activities.length > 0) {
            <div class="tool-activity-log mb-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                <div class="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
                        />
                    </svg>
                    <span>Tool Activity</span>
                </div>
                <div class="space-y-1.5">
                    @for (activity of activities; track activity.toolCallId) {
                        <div class="flex items-start gap-2 text-xs">
                            <!-- Status indicator -->
                            @if (activity.state === 'input-streaming' || activity.state === 'input-available') {
                                <span class="mt-0.5 flex h-4 w-4 items-center justify-center">
                                    <span class="tool-spinner"></span>
                                </span>
                            } @else if (activity.state === 'output-available') {
                                <span class="mt-0.5 flex h-4 w-4 items-center justify-center text-green-500">
                                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </span>
                            } @else if (activity.state === 'output-error') {
                                <span class="mt-0.5 flex h-4 w-4 items-center justify-center text-destructive">
                                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </span>
                            }

                            <div class="flex-1">
                                <span class="font-medium text-foreground">{{ getToolLabel(activity.toolName) }}</span>
                                @if (activity.input && showInputDetails(activity)) {
                                    <span class="ml-1 text-muted-foreground">{{ getInputSummary(activity) }}</span>
                                }
                                @if (activity.state === 'output-error' && activity.errorText) {
                                    <p class="mt-0.5 text-destructive">{{ activity.errorText }}</p>
                                }
                            </div>
                        </div>
                    }
                </div>
            </div>
        }
    `,
    styles: `
        .tool-spinner {
            width: 12px;
            height: 12px;
            border: 2px solid hsl(var(--muted-foreground) / 0.3);
            border-top-color: hsl(var(--foreground));
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
    `,
})
export class ToolActivityLog {
    @Input() activities: ToolActivity[] = [];

    getToolLabel(toolName: string): string {
        return TOOL_LABELS[toolName] || `🔧 ${toolName}`;
    }

    showInputDetails(activity: ToolActivity): boolean {
        // Show input details for certain tools
        const showFor = ['findRecipe', 'getRecipeDetail', 'optimizeRecipeQuery'];
        return showFor.includes(activity.toolName) && !!activity.input;
    }

    getInputSummary(activity: ToolActivity): string {
        const input = activity.input;
        if (!input) return '';

        switch (activity.toolName) {
            case 'findRecipe':
                return input['searchQuery'] ? `"${input['searchQuery']}"` : '';
            case 'getRecipeDetail':
                return input['recipeId'] ? `(${String(input['recipeId']).substring(0, 8)}...)` : '(context)';
            case 'optimizeRecipeQuery':
                return input['userQuery'] ? `"${input['userQuery']}"` : '';
            default:
                return '';
        }
    }
}

