import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import type { SavedRecipe } from '../types';

export default function RecipeBox() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cuisineFilter, setCuisineFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [editingRecipe, setEditingRecipe] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [scaledServings, setScaledServings] = useState<Record<number, number>>({});

  useEffect(() => {
    loadRecipes();
  }, [cuisineFilter, difficultyFilter]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const cuisine = cuisineFilter === 'All' ? undefined : cuisineFilter.toLowerCase();
      const difficulty = difficultyFilter === 'All' ? undefined : difficultyFilter.toLowerCase();
      const data = await apiClient.getSavedRecipes(cuisine, difficulty);
      setRecipes(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
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

  const parseJson = (str: string | null | undefined): any[] => {
    if (!str) return [];
    try {
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch {
      return [];
    }
  };

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📚 Recipe Box</h1>
        <p className="text-gray-600">Your saved favorite recipes</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Cuisine
            </label>
            <select
              value={cuisineFilter}
              onChange={(e) => setCuisineFilter(e.target.value)}
              className="input"
            >
              <option value="All">All</option>
              <option value="Italian">Italian</option>
              <option value="Mexican">Mexican</option>
              <option value="Asian">Asian</option>
              <option value="American">American</option>
              <option value="Mediterranean">Mediterranean</option>
              <option value="Indian">Indian</option>
              <option value="French">French</option>
              <option value="Thai">Thai</option>
              <option value="Japanese">Japanese</option>
              <option value="Chinese">Chinese</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Difficulty
            </label>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="input"
            >
              <option value="All">All</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

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
      ) : (
        <>
          <p className="text-gray-600 mb-4">Found {recipes.length} saved recipes</p>
          <div className="space-y-6">
            {recipes.map((recipe) => {
              const ingredients = parseJson(recipe.ingredients);
              const instructions = parseJson(recipe.instructions);
              const tags = parseJson(recipe.tags);
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
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tags.map((tag, i) => (
                            <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              🏷️ {tag}
                            </span>
                          ))}
                        </div>
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


                  <div className="flex justify-end gap-2">
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

