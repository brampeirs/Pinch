import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type ShimmerStatusVariant = 'thinking' | 'searching' | 'choosing-cover-image' | 'creating-recipe';

const DEFAULT_LABELS: Record<ShimmerStatusVariant, string> = {
    thinking: 'Thinking...',
    searching: 'Searching recipes...',
    'choosing-cover-image': 'Choosing cover image...',
    'creating-recipe': 'Creating recipe...',
};

@Component({
    selector: 'app-shimmer-status',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        role: 'status',
        'aria-live': 'polite',
    },
    template: `
        <span class="status-shimmer">
            <span class="status-icon">
                @switch (variant()) {
                    @case ('thinking') {
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                            />
                        </svg>
                    }
                    @case ('searching') {
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                            />
                        </svg>
                    }
                    @case ('choosing-cover-image') {
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3.375 7.5A2.625 2.625 0 016 4.875h12a2.625 2.625 0 012.625 2.625v9A2.625 2.625 0 0118 19.125H6A2.625 2.625 0 013.375 16.5v-9z"
                            />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m3.375 15.75 4.5-4.5a1.125 1.125 0 011.59 0l3.285 3.285"
                            />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m14.25 13.5 1.035-1.035a1.125 1.125 0 011.59 0l3.75 3.75"
                            />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75h.008v.008H9.75V9.75Z" />
                        </svg>
                    }
                    @case ('creating-recipe') {
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 8.25v7.5m3.75-3.75h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    }
                }
            </span>
            <span class="status-text">{{ label() }}</span>
        </span>
    `,
    styleUrl: './shimmer-status.scss',
})
export class ShimmerStatus {
    readonly variant = input.required<ShimmerStatusVariant>();
    readonly text = input<string>();
    readonly label = computed(() => this.text() || DEFAULT_LABELS[this.variant()]);
}
