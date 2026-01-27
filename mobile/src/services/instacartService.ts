/**
 * Instacart shopping integration service.
 * 
 * Provides utilities for creating Instacart shopping links
 * from recipes and inventory items.
 */

import { Linking, Alert } from 'react-native';
import apiClient from '../api/client';
import type { Recipe, RecentRecipe, SavedRecipe, InventoryItem, RecipeIngredient } from '../types';

export interface InstacartIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  display_text?: string;
}

export interface InstacartLinkResult {
  url: string;
  expiresAt?: string;
}

/**
 * Parse amount string like "2 cups" into quantity and unit.
 */
function parseAmount(amount: string | undefined): { quantity?: number; unit?: string } {
  if (!amount) return {};
  
  // Try to extract number and unit from strings like "2 cups", "1/2 tsp", "3"
  const match = amount.match(/^([\d./]+)\s*(.*)$/);
  if (match) {
    let quantity: number;
    const [, numStr, unit] = match;
    
    // Handle fractions like "1/2"
    if (numStr.includes('/')) {
      const [num, denom] = numStr.split('/');
      quantity = parseFloat(num) / parseFloat(denom);
    } else {
      quantity = parseFloat(numStr);
    }
    
    return {
      quantity: isNaN(quantity) ? undefined : quantity,
      unit: unit.trim() || undefined,
    };
  }
  
  return {};
}

/**
 * Convert recipe ingredients to Instacart format.
 */
function recipeIngredientsToInstacart(ingredients: RecipeIngredient[]): InstacartIngredient[] {
  return ingredients.map((ing) => {
    const { quantity, unit } = parseAmount(ing.amount);
    return {
      name: ing.item,
      quantity,
      unit,
      display_text: ing.amount ? `${ing.amount} ${ing.item}` : ing.item,
    };
  });
}

/**
 * Convert missing ingredient names to Instacart format.
 * Missing ingredients are just names, so we use defaults.
 */
function missingIngredientsToInstacart(ingredients: string[]): InstacartIngredient[] {
  return ingredients.map((name) => ({
    name,
    quantity: 1,
    unit: 'each',
  }));
}

/**
 * Convert inventory items to Instacart format.
 */
function inventoryItemsToInstacart(items: InventoryItem[]): InstacartIngredient[] {
  return items.map((item) => ({
    name: item.product_name || 'Unknown Item',
    quantity: item.quantity || 1,
    unit: item.unit || 'each',
  }));
}

/**
 * Instacart shopping service.
 */
export const instacartService = {
  /**
   * Check if Instacart integration is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const status = await apiClient.getInstacartStatus();
      return status.available;
    } catch (error) {
      console.error('Failed to check Instacart status:', error);
      return false;
    }
  },

  /**
   * Shop for missing recipe ingredients on Instacart.
   * 
   * Opens Instacart with the missing ingredients pre-populated.
   */
  async shopMissingIngredients(
    recipe: Recipe | RecentRecipe,
    onLoadingChange?: (loading: boolean) => void
  ): Promise<boolean> {
    const missingIngredients = recipe.missing_ingredients || [];
    
    if (missingIngredients.length === 0) {
      Alert.alert('No Missing Ingredients', 'You have all the ingredients for this recipe!');
      return false;
    }
    
    try {
      onLoadingChange?.(true);
      
      const ingredients = missingIngredientsToInstacart(missingIngredients);
      
      const result = await apiClient.createInstacartRecipeLink(
        recipe.name,
        ingredients,
        {
          instructions: recipe.instructions,
          servings: recipe.servings,
          cooking_time_minutes: recipe.prep_time && recipe.cook_time 
            ? recipe.prep_time + recipe.cook_time 
            : undefined,
        }
      );
      
      if (result.products_link_url) {
        const supported = await Linking.canOpenURL(result.products_link_url);
        if (supported) {
          await Linking.openURL(result.products_link_url);
          return true;
        } else {
          Alert.alert('Error', 'Unable to open Instacart link');
          return false;
        }
      }
      
      return false;
    } catch (error: any) {
      console.error('Failed to create Instacart link:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to connect to Instacart';
      Alert.alert('Instacart Error', message);
      return false;
    } finally {
      onLoadingChange?.(false);
    }
  },

  /**
   * Shop for all recipe ingredients on Instacart.
   * 
   * Opens Instacart with all recipe ingredients pre-populated.
   */
  async shopAllIngredients(
    recipe: Recipe | RecentRecipe | SavedRecipe,
    onLoadingChange?: (loading: boolean) => void
  ): Promise<boolean> {
    let ingredients: InstacartIngredient[];
    
    // Handle different recipe types
    if ('ingredients' in recipe) {
      if (typeof recipe.ingredients === 'string') {
        // SavedRecipe stores ingredients as JSON string
        try {
          const parsed = JSON.parse(recipe.ingredients);
          ingredients = recipeIngredientsToInstacart(parsed);
        } catch {
          ingredients = [];
        }
      } else if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
        // Recipe or RecentRecipe has RecipeIngredient[]
        ingredients = recipeIngredientsToInstacart(recipe.ingredients as RecipeIngredient[]);
      } else {
        ingredients = [];
      }
    } else {
      ingredients = [];
    }
    
    if (ingredients.length === 0) {
      Alert.alert('No Ingredients', 'This recipe has no ingredients to shop for.');
      return false;
    }
    
    try {
      onLoadingChange?.(true);
      
      // Get instructions
      let instructions: string[] | undefined;
      if ('instructions' in recipe) {
        if (typeof recipe.instructions === 'string') {
          try {
            instructions = JSON.parse(recipe.instructions);
          } catch {
            instructions = undefined;
          }
        } else {
          instructions = recipe.instructions;
        }
      }
      
      const result = await apiClient.createInstacartRecipeLink(
        recipe.name,
        ingredients,
        {
          instructions,
          servings: recipe.servings,
          cooking_time_minutes: recipe.prep_time && recipe.cook_time
            ? recipe.prep_time + recipe.cook_time
            : undefined,
        }
      );
      
      if (result.products_link_url) {
        const supported = await Linking.canOpenURL(result.products_link_url);
        if (supported) {
          await Linking.openURL(result.products_link_url);
          return true;
        } else {
          Alert.alert('Error', 'Unable to open Instacart link');
          return false;
        }
      }
      
      return false;
    } catch (error: any) {
      console.error('Failed to create Instacart link:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to connect to Instacart';
      Alert.alert('Instacart Error', message);
      return false;
    } finally {
      onLoadingChange?.(false);
    }
  },

  /**
   * Shop for low stock inventory items on Instacart.
   * 
   * Opens Instacart with low stock items pre-populated.
   */
  async shopLowStockItems(
    items: InventoryItem[],
    onLoadingChange?: (loading: boolean) => void
  ): Promise<boolean> {
    const lowStockItems = items.filter(item => item.status === 'low');
    
    if (lowStockItems.length === 0) {
      Alert.alert('No Low Stock Items', 'You have no items running low.');
      return false;
    }
    
    try {
      onLoadingChange?.(true);
      
      const instacartItems = inventoryItemsToInstacart(lowStockItems);
      
      const result = await apiClient.createInstacartShoppingListLink(
        'Low Stock Items - Smart Pantry',
        instacartItems
      );
      
      if (result.products_link_url) {
        const supported = await Linking.canOpenURL(result.products_link_url);
        if (supported) {
          await Linking.openURL(result.products_link_url);
          return true;
        } else {
          Alert.alert('Error', 'Unable to open Instacart link');
          return false;
        }
      }
      
      return false;
    } catch (error: any) {
      console.error('Failed to create Instacart link:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to connect to Instacart';
      Alert.alert('Instacart Error', message);
      return false;
    } finally {
      onLoadingChange?.(false);
    }
  },

  /**
   * Shop for specific inventory items on Instacart.
   */
  async shopItems(
    items: InventoryItem[],
    title: string = 'Shopping List - Smart Pantry',
    onLoadingChange?: (loading: boolean) => void
  ): Promise<boolean> {
    if (items.length === 0) {
      Alert.alert('No Items', 'No items to shop for.');
      return false;
    }
    
    try {
      onLoadingChange?.(true);
      
      const instacartItems = inventoryItemsToInstacart(items);
      
      const result = await apiClient.createInstacartShoppingListLink(title, instacartItems);
      
      if (result.products_link_url) {
        const supported = await Linking.canOpenURL(result.products_link_url);
        if (supported) {
          await Linking.openURL(result.products_link_url);
          return true;
        } else {
          Alert.alert('Error', 'Unable to open Instacart link');
          return false;
        }
      }
      
      return false;
    } catch (error: any) {
      console.error('Failed to create Instacart link:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to connect to Instacart';
      Alert.alert('Instacart Error', message);
      return false;
    } finally {
      onLoadingChange?.(false);
    }
  },
};

export default instacartService;
