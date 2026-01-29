/**
 * Format a recipe as plain text for sharing (messages, email, copy).
 * Handles both Recipe (arrays) and SavedRecipe (JSON strings).
 */
import type { Recipe, SavedRecipe } from '../types';

function parseIngredients(val: Recipe['ingredients'] | string): { item: string; amount?: string; notes?: string }[] {
  if (Array.isArray(val)) {
    return val.map((ing) =>
      typeof ing === 'string' ? { item: ing } : { item: ing.item, amount: ing.amount, notes: ing.notes }
    );
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseInstructions(val: Recipe['instructions'] | string): string[] {
  if (Array.isArray(val)) return val.map((s) => (typeof s === 'string' ? s : String(s)));
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map((s: unknown) => (typeof s === 'string' ? s : String(s))) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function formatRecipeForShare(recipe: Recipe | SavedRecipe): string {
  const ingredients = parseIngredients(recipe.ingredients);
  const instructions = parseInstructions(recipe.instructions);
  const lines: string[] = [];
  lines.push(recipe.name);
  lines.push('');
  if (recipe.description) {
    lines.push(recipe.description);
    lines.push('');
  }
  const prep = recipe.prep_time ?? 0;
  const cook = recipe.cook_time ?? 0;
  const serv = recipe.servings ?? 0;
  lines.push(`Prep: ${prep} min · Cook: ${cook} min · Serves ${serv}`);
  if (recipe.cuisine) lines.push(recipe.cuisine);
  lines.push('');
  lines.push('Ingredients');
  lines.push('—');
  ingredients.forEach((ing) => {
    let line = `• ${ing.item}`;
    if (ing.amount) line += `: ${ing.amount}`;
    if (ing.notes) line += ` (${ing.notes})`;
    lines.push(line);
  });
  lines.push('');
  lines.push('Instructions');
  lines.push('—');
  lines.push('');
  instructions.forEach((step, i) => {
    // Strip redundant "Step N - " or "Step N:" so we don't get "1. Step 1 - ..."
    const text = step.replace(/^Step\s+\d+\s*[-:]\s*/i, '').trim();
    lines.push(`${i + 1}. ${text}`);
    lines.push(''); // Blank line between steps for readability
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n'); // At most one blank line
}

/**
 * Share recipe via Web Share API if available, otherwise copy to clipboard.
 * Returns 'shared' | 'copied' | 'unsupported' | 'cancelled'.
 */
export async function shareRecipe(recipe: Recipe | SavedRecipe): Promise<'shared' | 'copied' | 'unsupported' | 'cancelled'> {
  const text = formatRecipeForShare(recipe);
  const title = recipe.name;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      });
      return 'shared';
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // Fallback to copy on share failure (e.g. no share targets)
      try {
        await navigator.clipboard.writeText(text);
        return 'copied';
      } catch {
        return 'unsupported';
      }
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'unsupported';
  }
}
