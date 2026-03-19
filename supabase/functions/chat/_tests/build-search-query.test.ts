import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildSearchQuery } from '../_lib/build-search-query.ts';

Deno.test('buildSearchQuery keeps a non-empty semantic query', () => {
    assertEquals(
        buildSearchQuery({ searchQuery: '  tomato basil pasta  ', category: 'Main Dishes', maxTime: 30 }),
        'tomato basil pasta',
    );
});

Deno.test('buildSearchQuery falls back to category when the search query is empty', () => {
    assertEquals(buildSearchQuery({ searchQuery: '   ', category: 'Soups', maxTime: null }), 'Soups');
});

Deno.test('buildSearchQuery combines category and time when both are the only filters', () => {
    assertEquals(buildSearchQuery({ searchQuery: '', category: 'Soups', maxTime: 30 }), 'Soups under 30 minutes');
});

Deno.test('buildSearchQuery falls back to a broad recipe query when no terms are present', () => {
    assertEquals(buildSearchQuery({ searchQuery: '', category: null, maxTime: null }), 'recipes');
});