interface RecipeSearchQueryOptions {
    searchQuery: string;
    category?: string | null;
    maxTime?: number | null;
}

function normalizeText(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function buildSearchQuery({ searchQuery, category, maxTime }: RecipeSearchQueryOptions): string {
    const normalizedSearchQuery = normalizeText(searchQuery);
    if (normalizedSearchQuery) {
        return normalizedSearchQuery;
    }

    const normalizedCategory = normalizeText(category);
    const hasMaxTime = typeof maxTime === 'number' && Number.isFinite(maxTime) && maxTime > 0;

    if (normalizedCategory && hasMaxTime) {
        return `${normalizedCategory} under ${maxTime} minutes`;
    }

    if (normalizedCategory) {
        return normalizedCategory;
    }

    if (hasMaxTime) {
        return `recipes under ${maxTime} minutes`;
    }

    return 'recipes';
}