/**
 * Category-specific placeholder images for recipes without images
 */

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  pasta: '/placeholders/pasta.svg',
  soups: '/placeholders/soups.svg',
  salads: '/placeholders/salads.svg',
  'main dishes': '/placeholders/main-dishes.svg',
  desserts: '/placeholders/desserts.svg',
  breakfast: '/placeholders/breakfast.svg',
};

const DEFAULT_PLACEHOLDER = '/placeholders/default.svg';

/**
 * Returns the appropriate placeholder image path for a category
 */
export function getCategoryPlaceholder(category: string): string {
  const categoryKey = category.toLowerCase();
  return CATEGORY_PLACEHOLDERS[categoryKey] || DEFAULT_PLACEHOLDER;
}

/**
 * Returns the image URL or a category-specific placeholder if no image is provided
 */
export function getDisplayImage(imageUrl: string | null | undefined, category: string): string {
  if (imageUrl) return imageUrl;
  return getCategoryPlaceholder(category);
}

