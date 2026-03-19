import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface RecipeEntryOption {
    title: string;
    description: string;
    icon: string;
    href?: string;
    enabled: boolean;
}

@Component({
    selector: 'app-new-recipe-chooser',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink],
    templateUrl: './new-recipe-chooser.html',
})
export class NewRecipeChooserPage {
    readonly options = [
        {
            title: 'Upload photos',
            description: 'Turn recipe photos into a draft we can refine together.',
            icon: '📸',
            enabled: false,
        },
        {
            title: 'Import from link',
            description: 'Paste a recipe URL and we’ll pull it into your recipe editor.',
            icon: '🔗',
            enabled: false,
        },
        {
            title: 'Write or paste',
            description: 'Start from scratch or paste recipe text into the existing form.',
            icon: '✍️',
            href: '/recipes/new/manual',
            enabled: true,
        },
    ] satisfies ReadonlyArray<RecipeEntryOption>;
}