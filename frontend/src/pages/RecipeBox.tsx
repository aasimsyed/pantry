import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { shareRecipe } from '../utils/recipeShare';
import type { SavedRecipe } from '../types';

const FILTER_CUISINES = [
  { label: 'All', value: null as string | null },
  { label: 'Indian', value: 'indian' }, { label: 'Italian', value: 'italian' }, { label: 'Mexican', value: 'mexican' },
  { label: 'Asian', value: 'asian' }, { label: 'American', value: 'american' }, { label: 'Mediterranean', value: 'mediterranean' },
  { label: 'French', value: 'french' }, { label: 'Thai', value: 'thai' }, { label: 'Japanese', value: 'japanese' }, { label: 'Chinese', value: 'chinese' },
];
const FILTER_DIFFICULTIES = [
  { label: 'All', value: null as string | null },
  { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' },
];
const FILTER_DIETARY = [
  { label: 'Vegan', value: 'vegan' }, { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Gluten-free', value: 'gluten-free' }, { label: 'Dairy-free', value: 'dairy-free' },
];
const FILTER_MEAL_TYPE = [
  { label: 'Breakfast', value: 'breakfast' }, { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' }, { label: 'Snack', value: 'snack' },
];
const FILTER_COOKING_METHOD = [
  { label: 'Grilled', value: 'grilled' }, { label: 'Baked', value: 'baked' },
  { label: 'One-pot', value: 'one-pot' }, { label: 'Quick', value: 'quick' },
];

export default function RecipeBox() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCuisine, setFilterCuisine] = useState<string | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);
  const [filterDietary, setFilterDietary] = useState<string[]>([]);
  const [filterMealType, setFilterMealType] = useState<string[]>([]);
  const [filterCookingMethod, setFilterCookingMethod] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecipe, setEditingRecipe] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [scaledServings, setScaledServings] = useState<Record<number, number>>({});
  const [shareFeedback, setShareFeedback] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const tags = [...filterDietary, ...filterMealType, ...filterCookingMethod];
      const data = await apiClient.getSavedRecipes(
        filterCuisine || undefined,
        filterDifficulty || undefined,
        tags.length > 0 ? tags : undefined
      );
      setRecipes(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    setFilterVisible(false);
    loadRecipes();
  };

  const clearFilter = () => {
    setFilterCuisine(null);
    setFilterDifficulty(null);
    setFilterDietary([]);
    setFilterMealType([]);
    setFilterCookingMethod([]);
  };

  const handleDelete = async (recipeId: number) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;

    try {
      await apiClient.deleteSavedRecipe(recipeId);
      await loadRecipes();
    } catch (err: any) {
      alert(`Failed to delete recipe: ${err.message}`);
    }
  };

  const handleEdit = (recipe: SavedRecipe) => {
    setEditingRecipe(recipe.id);
    setEditNotes(recipe.notes || '');
    setEditRating(recipe.rating || 0);
  };

  const handleSaveEdit = async (recipeId: number) => {
    try {
      await apiClient.updateSavedRecipe(recipeId, editNotes || undefined, editRating > 0 ? editRating : undefined);
      setEditingRecipe(null);
      await loadRecipes();
    } catch (err: any) {
      alert(`Failed to update recipe: ${err.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingRecipe(null);
    setEditNotes('');
    setEditRating(0);
  };

  const handleShare = async (recipe: SavedRecipe) => {
    const result = await shareRecipe(recipe);
    if (result === 'shared') setShareFeedback({ id: recipe.id, message: 'Shared!' });
    else if (result === 'copied') setShareFeedback({ id: recipe.id, message: 'Copied to clipboard' });
    else if (result === 'cancelled') return;
    else setShareFeedback({ id: recipe.id, message: 'Share not supported' });
    setTimeout(() => setShareFeedback(null), 2000);
  };

  const parseJson = (str: string | null | undefined): any[] => {
    if (!str) return [];
    try {
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch {
      return [];
    }
  };

  const filteredRecipes = recipes.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.cuisine && r.cuisine.toLowerCase().includes(q))
    );
  });

  const difficultyEmoji = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return '🟢';
      case 'medium':
        return '🟡';
      case 'hard':
        return '🔴';
      default:
        return '🟡';
    }
  };

  // Utility function to scale ingredient amounts
  const scaleAmount = (amount: string | undefined, scaleFactor: number): string => {
    if (!amount) return '';
    
    const amountStr = amount.trim();
    // Match: simple fractions, mixed numbers, decimals, or whole numbers (in that order)
    const numberMatch = amountStr.match(/^(\d+\/\d+|\d+(?:\.\d+)?\s+\d+\/\d+|\d+\.\d+|\d+)/);
    if (!numberMatch) return amount;
    
    const matchedText = numberMatch[0];
    const unitPart = amountStr.substring(matchedText.length).trim();
    
    let value = 0;
    if (matchedText.includes('/')) {
      if (matchedText.includes(' ')) {
        // Mixed number like "1 1/2"
        const parts = matchedText.split(/\s+/);
        const whole = parseFloat(parts[0]);
        const [num, den] = parts[1].split('/').map(Number);
        value = whole + (num / den);
      } else {
        // Simple fraction like "1/2"
        const [num, den] = matchedText.split('/').map(Number);
        value = num / den;
      }
    } else {
      value = parseFloat(matchedText);
    }
    
    const scaledValue = value * scaleFactor;
    
    if (scaledValue < 1 && scaledValue > 0) {
      const fraction = toFraction(scaledValue);
      return fraction + (unitPart ? ' ' + unitPart : '');
    } else {
      const rounded = Math.round(scaledValue * 100) / 100;
      const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
      return formatted + (unitPart ? ' ' + unitPart : '');
    }
  };

  const toFraction = (decimal: number): string => {
    const tolerance = 0.001;
    
    // Extended list of common cooking fractions
    const commonFractions = [
      [1, 8, '1/8'],
      [1, 4, '1/4'],
      [3, 8, '3/8'],
      [1, 2, '1/2'],
      [5, 8, '5/8'],
      [3, 4, '3/4'],
      [7, 8, '7/8'],
      [1, 3, '1/3'],
      [2, 3, '2/3'],
      [1, 5, '1/5'],
      [2, 5, '2/5'],
      [3, 5, '3/5'],
      [4, 5, '4/5'],
      [1, 6, '1/6'],
      [5, 6, '5/6'],
    ];
    
    // First try exact matches with common fractions
    for (const [num, den, str] of commonFractions) {
      if (Math.abs(decimal - num / den) < tolerance) {
        return str;
      }
    }
    
    // If no exact match, try to find the simplest fraction representation
    // Use continued fractions algorithm for better accuracy
    const maxDenominator = 64; // Common cooking denominators go up to 64 (like 1/64 tsp)
    let bestNum = 0;
    let bestDen = 1;
    let bestError = Math.abs(decimal);
    
    for (let den = 2; den <= maxDenominator; den++) {
      const num = Math.round(decimal * den);
      const error = Math.abs(decimal - num / den);
      if (error < bestError) {
        bestError = error;
        bestNum = num;
        bestDen = den;
      }
    }
    
    // Only use the calculated fraction if it's accurate enough
    if (bestError < tolerance) {
      // Simplify the fraction
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(Math.abs(bestNum), bestDen);
      const simplifiedNum = bestNum / divisor;
      const simplifiedDen = bestDen / divisor;
      
      // Prefer common fractions over calculated ones if close
      for (const [num, den, str] of commonFractions) {
        if (simplifiedNum === num && simplifiedDen === den) {
          return str;
        }
      }
      
      // Return simplified fraction
      return `${simplifiedNum}/${simplifiedDen}`;
    }
    
    // Fallback: return as decimal (rounded to 2 places)
    return decimal.toFixed(2).replace(/\.?0+$/, '');
  };

  // Utility function to remove duplicate brand names from ingredient names
  const cleanIngredientName = (name: string): string => {
    if (!name || typeof name !== 'string') return name;
    
    // Split into words
    const words = name.trim().split(/\s+/);
    if (words.length < 2) return name;
    
    // Check if first word(s) are repeated (common pattern: "Brand Brand Product Name")
    // Try matching 1-3 words at the start
    for (let wordCount = 1; wordCount <= Math.min(3, Math.floor(words.length / 2)); wordCount++) {
      const firstPart = words.slice(0, wordCount).join(' ');
      const secondPart = words.slice(wordCount, wordCount * 2).join(' ');
      
      // Case-insensitive comparison
      if (firstPart.toLowerCase() === secondPart.toLowerCase()) {
        // Found duplicate! Remove the first occurrence
        return words.slice(wordCount).join(' ');
      }
    }
    
    return name;
  };

  const getScaledServings = (recipeId: number, originalServings: number): number => {
    return scaledServings[recipeId] ?? originalServings;
  };

  const setRecipeScaledServings = (recipeId: number, servings: number) => {
    setScaledServings(prev => ({ ...prev, [recipeId]: servings }));
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📚 Recipe Box</h1>
          <p className="text-gray-600">Your saved favorite recipes</p>
        </div>
        <button
          type="button"
          onClick={() => setFilterVisible(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label="Open filters"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 6.293A1 1 0 013 5.586V4z" />
          </svg>
          <span className="font-medium">Filter</span>
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Search recipes</label>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, description, or cuisine..."
          className="input w-full"
          aria-label="Search recipes"
        />
      </div>

      {/* Filter modal */}
      {filterVisible && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setFilterVisible(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-title"
        >
          <div
            className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 id="filter-title" className="text-xl font-semibold text-gray-900 tracking-tight">Filters</h2>
              <button type="button" onClick={() => setFilterVisible(false)} className="p-2 -m-2 text-gray-500 hover:text-gray-700" aria-label="Close">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Cuisine</p>
                <div className="space-y-px">
                  {FILTER_CUISINES.map(({ label, value }) => (
                    <button
                      key={value ?? 'all'}
                      type="button"
                      onClick={() => setFilterCuisine(value)}
                      className="w-full flex items-center justify-between py-3.5 text-left border-b border-gray-50"
                    >
                      <span className="text-gray-900 font-normal">{label}</span>
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${filterCuisine === value ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Difficulty</p>
                <div className="space-y-px">
                  {FILTER_DIFFICULTIES.map(({ label, value }) => (
                    <button
                      key={value ?? 'all'}
                      type="button"
                      onClick={() => setFilterDifficulty(value)}
                      className="w-full flex items-center justify-between py-3.5 text-left border-b border-gray-50"
                    >
                      <span className="text-gray-900 font-normal">{label}</span>
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${filterDifficulty === value ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Dietary</p>
                <div className="space-y-px">
                  {FILTER_DIETARY.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilterDietary((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))}
                      className="w-full flex items-center justify-between py-3.5 text-left border-b border-gray-50"
                    >
                      <span className="text-gray-900 font-normal">{label}</span>
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${filterDietary.includes(value) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Meal type</p>
                <div className="space-y-px">
                  {FILTER_MEAL_TYPE.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilterMealType((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))}
                      className="w-full flex items-center justify-between py-3.5 text-left border-b border-gray-50"
                    >
                      <span className="text-gray-900 font-normal">{label}</span>
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${filterMealType.includes(value) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Cooking method</p>
                <div className="space-y-px">
                  {FILTER_COOKING_METHOD.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilterCookingMethod((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))}
                      className="w-full flex items-center justify-between py-3.5 text-left border-b border-gray-50"
                    >
                      <span className="text-gray-900 font-normal">{label}</span>
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${filterCookingMethod.includes(value) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <div className="flex items-center gap-3 px-6 py-5 border-t border-gray-100">
              <button type="button" onClick={clearFilter} className="px-4 py-2.5 text-gray-600 font-medium hover:text-gray-900">
                Clear all
              </button>
              <button type="button" onClick={applyFilter} className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Loading your recipes...</p>
          </div>
        </div>
      ) : error ? (
        <div className="card border-2 border-red-300 bg-red-50">
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-4xl mb-4">❌</p>
            <p className="text-red-600 font-semibold mb-2">Error Loading Recipes</p>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button onClick={loadRecipes} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      ) : recipes.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-6xl mb-4">📚</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Recipes Yet</h2>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              Your saved recipes will appear here. Generate and save recipes from the Recipes page!
            </p>
            <a href="/recipes" className="btn-primary">
              Go to Recipes
            </a>
          </div>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-2xl font-bold text-gray-900 mb-2">No matches</p>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              No recipes match &quot;{searchQuery.trim()}&quot;. Try a different search or clear the search box.
            </p>
            <button type="button" onClick={() => setSearchQuery('')} className="btn-secondary">
              Clear search
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-gray-600 mb-4">
            {filteredRecipes.length === recipes.length
              ? `Found ${recipes.length} saved recipes`
              : `Showing ${filteredRecipes.length} of ${recipes.length} recipes`}
          </p>
          <div className="space-y-6">
            {filteredRecipes.map((recipe) => {
              const ingredients = parseJson(recipe.ingredients);
              const instructions = parseJson(recipe.instructions);
              const originalServings = recipe.servings || 4;
              const currentServings = getScaledServings(recipe.id, originalServings);
              const scaleFactor = currentServings / originalServings;

              return (
                <div key={recipe.id} className="card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold mb-2">{recipe.name}</h2>
                      {recipe.description && (
                        <p className="text-gray-600 mb-2">{recipe.description}</p>
                      )}
                      {recipe.cuisine && (
                        <p className="text-sm text-gray-500">🌍 {recipe.cuisine} Cuisine</p>
                      )}
                      {recipe.ai_model && (
                        <p className="text-xs text-gray-400 mt-1">🤖 Generated by {recipe.ai_model}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">
                        {difficultyEmoji(recipe.difficulty)} {recipe.difficulty || 'Medium'}
                      </p>
                      <p className="text-sm text-gray-600">⏱️ Prep: {recipe.prep_time || 0} min</p>
                      <p className="text-sm text-gray-600">🔥 Cook: {recipe.cook_time || 0} min</p>
                      <p className="text-sm text-gray-600">👥 Serves: {currentServings}</p>
                      {recipe.rating && (
                        <p className="text-sm text-gray-600">
                          ⭐ Rating: {'⭐'.repeat(recipe.rating)}
                        </p>
                      )}
                    </div>
                  </div>

                  {editingRecipe === recipe.id ? (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">Edit Notes & Rating</h3>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Rating: {editRating}/5
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          value={editRating}
                          onChange={(e) => setEditRating(parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="input w-full h-24"
                          placeholder="Add your personal notes about this recipe..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(recipe.id)}
                          className="btn-primary"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {recipe.notes && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <h3 className="font-semibold mb-1">📝 Notes</h3>
                          <p className="text-sm text-gray-600">{recipe.notes}</p>
                        </div>
                      )}
                      
                      {/* Servings Scale Control */}
                      <div className="mb-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                        <h3 className="font-semibold mb-2 text-blue-700">📏 Scale Recipe</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Adjust servings: <strong>{currentServings}</strong> {currentServings === 1 ? 'serving' : 'servings'}
                          {scaleFactor !== 1 && (
                            <span className="text-gray-500">
                              {' '}({scaleFactor > 1 ? '+' : ''}{((scaleFactor - 1) * 100).toFixed(0)}%)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-sm text-gray-600 w-8">1</span>
                          <input
                            type="range"
                            min="1"
                            max="20"
                            value={currentServings}
                            onChange={(e) => setRecipeScaledServings(recipe.id, parseInt(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-sm text-gray-600 w-8">20</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRecipeScaledServings(recipe.id, Math.max(1, currentServings - 1))}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => setRecipeScaledServings(recipe.id, originalServings)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Reset ({originalServings})
                          </button>
                          <button
                            onClick={() => setRecipeScaledServings(recipe.id, Math.min(20, currentServings + 1))}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                          >
                            +1
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <h3 className="font-semibold mb-2">📋 Ingredients</h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Ingredient</th>
                              <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ingredients.length > 0 ? (
                              ingredients.map((ing, i) => {
                                const rawItemName = typeof ing === 'string' ? ing : ing.item || ing.name || JSON.stringify(ing);
                                const itemName = cleanIngredientName(rawItemName);
                                const originalAmount = typeof ing === 'object' ? ing.amount : undefined;
                                const scaledAmount = scaleFactor !== 1 && originalAmount 
                                  ? scaleAmount(originalAmount, scaleFactor)
                                  : originalAmount;
                                
                                return (
                                  <tr key={i} className="border-t border-gray-200">
                                    <td className="px-4 py-2">{itemName}</td>
                                    <td className="px-4 py-2 text-right">
                                      {scaledAmount ? (
                                        <div>
                                          <span>{scaledAmount}</span>
                                          {scaleFactor !== 1 && originalAmount && originalAmount !== scaledAmount && (
                                            <span className="text-gray-400 italic text-xs block">
                                              (was {originalAmount})
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={2} className="px-4 py-2 text-gray-500 text-center">
                                  No ingredients listed
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">👨‍🍳 Instructions</h3>
                      <ol className="list-decimal list-inside space-y-2">
                        {instructions.length > 0 ? (
                          instructions.map((step, i) => (
                            <li key={i}>{typeof step === 'string' ? step : JSON.stringify(step)}</li>
                          ))
                        ) : (
                          <li className="text-gray-500">No instructions provided</li>
                        )}
                      </ol>
                    </div>
                  </div>


                  <div className="flex justify-end gap-2 items-center flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleShare(recipe)}
                      className="btn-secondary"
                      title="Share recipe"
                    >
                      📤 Share
                    </button>
                    {editingRecipe !== recipe.id && (
                      <button
                        onClick={() => handleEdit(recipe)}
                        className="btn-secondary"
                      >
                        ✏️ Edit Notes & Rating
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(recipe.id)}
                      className="btn-secondary text-red-600 hover:bg-red-50"
                    >
                      🗑️ Delete
                    </button>
                    {shareFeedback?.id === recipe.id && (
                      <span className="text-sm text-gray-500 animate-pulse" role="status">
                        {shareFeedback.message}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

