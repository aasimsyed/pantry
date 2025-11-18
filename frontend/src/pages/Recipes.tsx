import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import type { Recipe, InventoryItem } from '../types';

export default function Recipes() {
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Recipe options
  const [requiredIngredients, setRequiredIngredients] = useState<string[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [numRecipes, setNumRecipes] = useState(5);
  const [cuisine, setCuisine] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [allowMissing, setAllowMissing] = useState(false);

  useEffect(() => {
    loadAvailableIngredients();
  }, []);

  const loadAvailableIngredients = async () => {
    try {
      const items = await apiClient.getInventory(0, 1000, undefined, 'in_stock');
      const uniqueNames = new Set<string>();
      items.forEach((item) => {
        if (item.product_name) uniqueNames.add(item.product_name);
      });
      setAvailableIngredients(Array.from(uniqueNames).sort());
    } catch (err: any) {
      setError(err.message || 'Failed to load ingredients');
    }
  };

  const handleGenerateRecipes = async () => {
    try {
      setGenerating(true);
      setProgress(0);
      setError(null);
      setRecipes([]);

      const newRecipes: Recipe[] = [];
      const avoidNames: string[] = [];

      for (let i = 0; i < numRecipes; i++) {
        setProgress(((i + 1) / numRecipes) * 100);

        const recipe = await apiClient.generateSingleRecipe({
          required_ingredients: requiredIngredients.length > 0 ? requiredIngredients : undefined,
          excluded_ingredients: excludedIngredients.length > 0 ? excludedIngredients : undefined,
          cuisine: cuisine || undefined,
          difficulty: difficulty ? difficulty.toLowerCase() : undefined,
          dietary_restrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
          avoid_names: avoidNames,
          allow_missing_ingredients: allowMissing,
        });

        newRecipes.push(recipe);
        if (recipe.name) avoidNames.push(recipe.name);
        setRecipes([...newRecipes]);
      }

      setProgress(100);
    } catch (err: any) {
      setError(err.message || 'Failed to generate recipes');
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  const handleSaveRecipe = async (recipe: Recipe) => {
    try {
      await apiClient.saveRecipe({
        name: recipe.name,
        description: recipe.description,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      });
      alert(`Saved "${recipe.name}" to recipe box!`);
    } catch (err: any) {
      alert(`Failed to save recipe: ${err.message}`);
    }
  };

  const difficultyEmoji = (diff: string) => {
    switch (diff.toLowerCase()) {
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

  if (availableIngredients.length === 0 && !error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card">
          <p className="text-orange-600 mb-4">⚠️ No items in stock. Add items to your pantry first!</p>
          <a href="/inventory" className="btn-primary">
            Go to Inventory
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🍳 Recipe Suggestions</h1>
        <p className="text-gray-600">AI-powered recipe suggestions based on your pantry items</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            <h2 className="text-xl font-semibold mb-4">⚙️ Recipe Options</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ✅ Required Ingredients
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Must be included (but recipes can use other ingredients too)
                </p>
                <select
                  multiple
                  value={requiredIngredients}
                  onChange={(e) =>
                    setRequiredIngredients(
                      Array.from(e.target.selectedOptions, (option) => option.value)
                    )
                  }
                  className="input h-32"
                  size={5}
                >
                  {availableIngredients.map((ing) => (
                    <option key={ing} value={ing}>
                      {ing}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ❌ Excluded Ingredients
                </label>
                <p className="text-xs text-gray-500 mb-2">Must NOT be included</p>
                <select
                  multiple
                  value={excludedIngredients}
                  onChange={(e) =>
                    setExcludedIngredients(
                      Array.from(e.target.selectedOptions, (option) => option.value)
                    )
                  }
                  className="input h-32"
                  size={5}
                >
                  {availableIngredients.map((ing) => (
                    <option key={ing} value={ing}>
                      {ing}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Recipes
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numRecipes}
                  onChange={(e) => setNumRecipes(parseInt(e.target.value))}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cuisine Type (Optional)
                </label>
                <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="input">
                  <option value="">Any</option>
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
                  Difficulty (Optional)
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="input"
                >
                  <option value="">Any</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dietary Restrictions (Optional)
                </label>
                <div className="space-y-2">
                  {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto', 'Paleo'].map(
                    (diet) => (
                      <label key={diet} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={dietaryRestrictions.includes(diet)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDietaryRestrictions([...dietaryRestrictions, diet]);
                            } else {
                              setDietaryRestrictions(dietaryRestrictions.filter((d) => d !== diet));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{diet}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={allowMissing}
                    onChange={(e) => setAllowMissing(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">✨ Allow Missing Ingredients</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Allow recipes with 2-4 ingredients not in pantry
                </p>
              </div>

              <button
                onClick={handleGenerateRecipes}
                disabled={generating}
                className="btn-primary w-full"
              >
                {generating ? 'Generating...' : '🍳 Generate Recipes'}
              </button>

              {recipes.length > 0 && (
                <button
                  onClick={() => {
                    setRecipes([]);
                    handleGenerateRecipes();
                  }}
                  disabled={generating}
                  className="btn-secondary w-full"
                >
                  🔄 Regenerate
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {generating && (
            <div className="card mb-6">
              <div className="mb-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                🍳 Generating recipe {recipes.length + 1} of {numRecipes}...
              </p>
            </div>
          )}

          {error && (
            <div className="card mb-6 border-2 border-red-300 bg-red-50">
              <p className="text-red-600">❌ {error}</p>
              <p className="text-sm text-gray-600 mt-2">
                💡 Make sure your OpenAI API key is configured in `.env`
              </p>
            </div>
          )}

          {recipes.length > 0 && (
            <div className="mb-6">
              <p className="text-green-600 font-semibold">
                ✅ {recipes.length} recipes generated!
              </p>
              {(requiredIngredients.length > 0 || excludedIngredients.length > 0) && (
                <div className="mt-2 text-sm text-gray-600">
                  {requiredIngredients.length > 0 && (
                    <span>✅ Required: {requiredIngredients.join(', ')}</span>
                  )}
                  {excludedIngredients.length > 0 && (
                    <span className="ml-4">❌ Excluded: {excludedIngredients.join(', ')}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {recipes.length === 0 && !generating && !error && (
            <div className="card">
              <p className="text-gray-600 mb-4">
                👆 Use the sidebar to configure recipe options and click 'Generate Recipes'
              </p>
              <h3 className="font-semibold mb-2">📦 Available Ingredients</h3>
              <p className="text-sm text-gray-600 mb-4">
                You have <strong>{availableIngredients.length}</strong> unique products in stock:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {availableIngredients.map((ing) => (
                  <div key={ing} className="text-sm">
                    • {ing}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recipes.map((recipe, idx) => (
            <div key={idx} className="card mb-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">
                    {idx + 1}. {recipe.name}
                  </h2>
                  {recipe.description && <p className="text-gray-600 mb-2">{recipe.description}</p>}
                  {recipe.cuisine && (
                    <p className="text-sm text-gray-500">🌍 {recipe.cuisine} Cuisine</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {difficultyEmoji(recipe.difficulty)} {recipe.difficulty}
                  </p>
                  <p className="text-sm text-gray-600">⏱️ Prep: {recipe.prep_time} min</p>
                  <p className="text-sm text-gray-600">🔥 Cook: {recipe.cook_time} min</p>
                  <p className="text-sm text-gray-600">👥 Serves: {recipe.servings}</p>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold mb-2">📋 Ingredients</h3>
                <ul className="list-disc list-inside space-y-1">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i}>
                      <strong>{typeof ing === 'string' ? ing : ing.item}</strong>
                      {typeof ing === 'object' && ing.amount && `: ${ing.amount}`}
                      {typeof ing === 'object' && ing.notes && ` (${ing.notes})`}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold mb-2">👨‍🍳 Instructions</h3>
                <ol className="list-decimal list-inside space-y-2">
                  {recipe.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              {recipe.flavor_pairings && recipe.flavor_pairings.length > 0 && (
                <div className="mb-4 p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold mb-2">🧪 Flavor Chemistry</h3>
                  <p className="text-xs text-gray-600 mb-2">
                    Scientifically-proven flavor pairings based on shared chemical compounds
                  </p>
                  {recipe.flavor_pairings.map((pairing, i) => (
                    <details key={i} className="mb-2">
                      <summary className="cursor-pointer font-medium text-sm">
                        🔬 {pairing.ingredients.slice(0, 2).join(' + ')}
                        {pairing.ingredients.length > 2 && ` + ${pairing.ingredients.length - 2} more`}
                      </summary>
                      <div className="mt-2 text-sm">
                        {pairing.compounds && (
                          <p>
                            <strong>Shared Compounds:</strong> {pairing.compounds}
                          </p>
                        )}
                        {pairing.effect && (
                          <p>
                            <strong>Effect:</strong> {pairing.effect}
                          </p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
                <div className="mb-4 p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                  <h3 className="font-semibold mb-2">🛒 Missing Ingredients (Shopping List)</h3>
                  <p className="text-xs text-gray-600 mb-2">
                    These ingredients are not in your pantry but are needed for this recipe:
                  </p>
                  <ul className="list-disc list-inside">
                    {recipe.missing_ingredients.map((item, i) => (
                      <li key={i} className="font-medium">
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-600 mt-2">
                    💡 Tip: Add these items to your shopping list or pantry to make this recipe!
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={() => handleSaveRecipe(recipe)} className="btn-primary">
                  💾 Save Recipe
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

