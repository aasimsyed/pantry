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
                      <p className="text-sm text-gray-600">👥 Serves: {recipe.servings || 4}</p>
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
                    </>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <h3 className="font-semibold mb-2">📋 Ingredients</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {ingredients.length > 0 ? (
                          ingredients.map((ing, i) => (
                            <li key={i}>
                              {typeof ing === 'string' ? ing : ing.item || ing.name || JSON.stringify(ing)}
                              {typeof ing === 'object' && ing.amount && `: ${ing.amount}`}
                            </li>
                          ))
                        ) : (
                          <li className="text-gray-500">No ingredients listed</li>
                        )}
                      </ul>
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

