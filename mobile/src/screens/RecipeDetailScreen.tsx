import React, { useState, useEffect, useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { Card, Text, Divider, Button, TextInput, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import { instacartService } from '../services/instacartService';

// Instacart branding - using approved green color
const INSTACART_GREEN = '#43B02A';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { DesignSystem, getDesignSystem, getTextStyle } from '../utils/designSystem';
import { ScreenContentWrapper } from '../components/ScreenContentWrapper';
import { FlavorChemistrySheet } from '../components/FlavorChemistrySheet';
import { InstacartLogo } from '../components/InstacartLogo';
import type { Recipe, RecentRecipe, SavedRecipe, FlavorPairing } from '../types';

type RouteParams = {
  RecipeDetail: {
    recipe: Recipe | RecentRecipe | SavedRecipe;
  };
};

/** Format recipe as plain text for sharing (messages, email, etc.). */
function formatRecipeForShare(r: Recipe | RecentRecipe | SavedRecipe): string {
  const parseJson = (val: unknown): unknown[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [];
  };
  const ingList = 'ingredients' in r && typeof r.ingredients === 'string'
    ? parseJson(r.ingredients)
    : Array.isArray(r.ingredients) ? r.ingredients : [];
  const instrList = 'instructions' in r && typeof r.instructions === 'string'
    ? parseJson(r.instructions)
    : Array.isArray(r.instructions) ? r.instructions : [];

  const lines: string[] = [];
  lines.push(r.name);
  lines.push('');
  if (r.description) {
    lines.push(r.description);
    lines.push('');
  }
  const prep = r.prep_time ?? 0;
  const cook = r.cook_time ?? 0;
  const serv = r.servings ?? 0;
  lines.push(`Prep: ${prep} min · Cook: ${cook} min · Serves ${serv}`);
  if (r.cuisine) lines.push(r.cuisine);
  lines.push('');
  lines.push('Ingredients');
  lines.push('—');
  ingList.forEach((ing: unknown) => {
    if (typeof ing === 'string') {
      lines.push(`• ${ing}`);
    } else if (ing && typeof ing === 'object' && 'item' in ing) {
      const item = (ing as { item?: string; amount?: string; notes?: string }).item ?? '';
      const amount = (ing as { amount?: string }).amount ?? '';
      const notes = (ing as { notes?: string }).notes ?? '';
      let line = `• ${item}`;
      if (amount) line += `: ${amount}`;
      if (notes) line += ` (${notes})`;
      lines.push(line);
    }
  });
  lines.push('');
  lines.push('Instructions');
  lines.push('—');
  lines.push('');
  instrList.forEach((step: unknown, i: number) => {
    let text = typeof step === 'string' ? step : String(step);
    // Strip redundant "Step N - " or "Step N:" so we don't get "1. Step 1 - ..."
    text = text.replace(/^Step\s+\d+\s*[-:]\s*/i, '').trim();
    lines.push(`${i + 1}. ${text}`);
    lines.push(''); // Blank line between steps for readability
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n'); // At most one blank line
}

export default function RecipeDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'RecipeDetail'>>();
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const { recipe: initialRecipe } = route.params;
  const [recipe, setRecipe] = useState(initialRecipe);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [notes, setNotes] = useState('notes' in recipe ? (recipe.notes || '') : '');
  const [rating, setRating] = useState('rating' in recipe ? (recipe.rating || 0) : 0);
  const [saving, setSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [scaledServings, setScaledServings] = useState(recipe.servings || 4);
  const [flavorSheetVisible, setFlavorSheetVisible] = useState(false);
  const [instacartLoading, setInstacartLoading] = useState(false);
  const [calculatedMissingIngredients, setCalculatedMissingIngredients] = useState<string[]>([]);
  const [loadingMissing, setLoadingMissing] = useState(false);

  // Track keyboard visibility
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Check if this is a SavedRecipe
  // SavedRecipe: has id, has created_at/updated_at (from to_dict()), NO generated_at
  // RecentRecipe: has id, has generated_at, NO created_at/updated_at
  // Recipe (generated): no id, no timestamps
  // 
  // Note: All SavedRecipe records (old and new) have created_at/updated_at because:
  // - They're required fields with default values in the database
  // - to_dict() always includes them in the API response
  const isSavedRecipe = 
    'id' in recipe && 
    !('generated_at' in recipe) && // Not a RecentRecipe
    (('created_at' in recipe) || ('updated_at' in recipe)); // Has SavedRecipe timestamps

  // Calculate missing ingredients for saved recipes by comparing against current inventory
  useEffect(() => {
    if (!isSavedRecipe) return;
    
    // If recipe already has missing_ingredients, don't recalculate
    if ('missing_ingredients' in recipe && recipe.missing_ingredients && recipe.missing_ingredients.length > 0) {
      return;
    }
    
    const calculateMissing = async () => {
      setLoadingMissing(true);
      try {
        // Get current inventory
        const inventory = await apiClient.getInventory(0, 1000);
        
        // Get recipe ingredients
        let recipeIngredients: string[] = [];
        if ('ingredients' in recipe) {
          if (typeof recipe.ingredients === 'string') {
            try {
              const parsed = JSON.parse(recipe.ingredients);
              recipeIngredients = parsed.map((ing: any) => {
                if (typeof ing === 'string') return ing.toLowerCase();
                return (ing.item || ing.name || '').toLowerCase();
              });
            } catch {
              recipeIngredients = [];
            }
          } else if (Array.isArray(recipe.ingredients)) {
            recipeIngredients = recipe.ingredients.map((ing: any) => {
              if (typeof ing === 'string') return ing.toLowerCase();
              return (ing.item || ing.name || '').toLowerCase();
            });
          }
        }
        
        // Get inventory item names (lowercase for comparison)
        const inventoryNames = inventory.map(item => 
          (item.product_name || '').toLowerCase()
        );
        
        // Find missing ingredients (not in inventory)
        const missing = recipeIngredients.filter(ingredient => {
          // Check if any inventory item contains this ingredient name
          return !inventoryNames.some(invName => 
            invName.includes(ingredient) || ingredient.includes(invName)
          );
        });
        
        // Get original ingredient names (not lowercased) for display
        let originalIngredients: string[] = [];
        if ('ingredients' in recipe) {
          if (typeof recipe.ingredients === 'string') {
            try {
              const parsed = JSON.parse(recipe.ingredients);
              originalIngredients = parsed.map((ing: any) => {
                if (typeof ing === 'string') return ing;
                return ing.item || ing.name || '';
              });
            } catch {
              originalIngredients = [];
            }
          } else if (Array.isArray(recipe.ingredients)) {
            originalIngredients = recipe.ingredients.map((ing: any) => {
              if (typeof ing === 'string') return ing;
              return ing.item || ing.name || '';
            });
          }
        }
        
        // Map back to original names
        const missingOriginal = originalIngredients.filter(orig => {
          const lower = orig.toLowerCase();
          return missing.includes(lower);
        });
        
        setCalculatedMissingIngredients(missingOriginal);
      } catch (err) {
        console.error('Failed to calculate missing ingredients:', err);
      } finally {
        setLoadingMissing(false);
      }
    };
    
    calculateMissing();
  }, [isSavedRecipe, recipe]);

  const handleSaveNotesRating = async () => {
    if (!isSavedRecipe) return;
    
    setSaving(true);
    try {
      // Always send notes (even if empty string) to allow clearing notes
      // Send rating only if > 0 (0 means no rating)
      // notes is always a string (initialized from recipe.notes || ''), so we always send it
      const updated = await apiClient.updateSavedRecipe(
        recipe.id,
        notes.trim(), // Send trimmed notes (empty string to clear)
        rating > 0 ? rating : undefined, // Only send rating if > 0
        undefined // tags not editable here
      );
      setRecipe(updated);
      setEditDialogVisible(false);
      Alert.alert('Success', 'Recipe updated successfully');
    } catch (err: any) {
      console.error('Error updating recipe:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update recipe';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const parseJson = (str: string | null | undefined): any[] => {
    if (!str) return [];
    try {
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch {
      return [];
    }
  };

  const originalServings = recipe.servings || 4;
  const scaleFactor = scaledServings / originalServings;

  // Utility function to scale ingredient amounts
  const scaleAmount = (amount: string | undefined): string => {
    if (!amount) return '';
    
    // Try to parse and scale the amount
    // Handle formats like: "2 cups", "1/2 tsp", "1 1/2 cups", "1.5 cups"
    const amountStr = amount.trim();
    
    // Match whole numbers, decimals, or fractions - match fractions first to avoid partial matches
    // Match: simple fractions, mixed numbers, decimals, or whole numbers (in that order)
    const numberMatch = amountStr.match(/^(\d+\/\d+|\d+(?:\.\d+)?\s+\d+\/\d+|\d+\.\d+|\d+)/);
    if (!numberMatch) return amount; // Can't parse, return original
    
    const matchedText = numberMatch[0];
    const unitPart = amountStr.substring(matchedText.length).trim();
    
    // Convert matched text to decimal
    let value = 0;
    if (matchedText.includes('/')) {
      // Handle fractions like "1/2" or "1 1/2"
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
    
    // Scale the value
    const scaledValue = value * scaleFactor;
    
    // Format the result
    if (scaledValue < 1 && scaledValue > 0) {
      // Convert to fraction if less than 1
      const fraction = toFraction(scaledValue);
      return fraction + (unitPart ? ' ' + unitPart : '');
    } else {
      // Round to 2 decimal places, remove trailing zeros
      const rounded = Math.round(scaledValue * 100) / 100;
      const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
      return formatted + (unitPart ? ' ' + unitPart : '');
    }
  };

  // Convert decimal to fraction (simplified)
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

  const ingredients = 'ingredients' in recipe && typeof recipe.ingredients === 'string'
    ? parseJson(recipe.ingredients)
    : Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  const instructions = 'instructions' in recipe && typeof recipe.instructions === 'string'
    ? parseJson(recipe.instructions)
    : Array.isArray(recipe.instructions) ? recipe.instructions : [];

  // Extract flavor pairings - handle both JSON string and array formats
  const flavorPairings: FlavorPairing[] = (() => {
    if (__DEV__) {
      console.log('RecipeDetailScreen - recipe type:', isSavedRecipe ? 'SavedRecipe' : ('generated_at' in recipe ? 'RecentRecipe' : 'Recipe'));
      console.log('RecipeDetailScreen - flavor_pairings in recipe:', 'flavor_pairings' in recipe);
      console.log('RecipeDetailScreen - flavor_pairings value:', (recipe as any).flavor_pairings);
    }
    if (!('flavor_pairings' in recipe) || !recipe.flavor_pairings) return [];
    const fp = recipe.flavor_pairings;
    // Handle empty array from API (returned as [] when null)
    if (Array.isArray(fp) && fp.length === 0) return [];
    if (typeof fp === 'string') {
      try {
        const parsed = JSON.parse(fp);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(fp) ? fp : [];
  })();

  const handleShare = async () => {
    try {
      const message = formatRecipeForShare(recipe);
      await Share.share({
        message,
        title: recipe.name,
      });
    } catch (err) {
      if ((err as { message?: string })?.message !== 'User did not share') {
        Alert.alert('Share failed', (err as Error)?.message ?? 'Could not open share sheet.');
      }
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleShare}
          style={styles.headerShareButton}
          accessibilityLabel="Share recipe"
          accessibilityHint="Double tap to share recipe"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="share-outline" size={24} color={ds.colors.textPrimary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, recipe, ds.colors.textPrimary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          layout.isTablet && { paddingHorizontal: layout.horizontalPadding, alignItems: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContentWrapper>
        {/* Hero Section - Minimal */}
        <View style={styles.heroSection}>
          <Text testID="recipe-detail-title" style={[styles.heroTitle, { color: ds.colors.textPrimary }]}>
            {recipe.name}
          </Text>
          {recipe.description && (
            <Text testID="recipe-detail-description" style={[styles.heroDescription, { color: ds.colors.textSecondary }]}>
              {recipe.description}
            </Text>
          )}
        </View>

        {/* Meta Information - Clean inline */}
        <View style={[styles.metaSection, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: ds.colors.textTertiary }]}>
                PREP
              </Text>
              <Text style={[styles.metaValue, { color: ds.colors.textPrimary }]}>
                {recipe.prep_time || 0} min
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: ds.colors.textTertiary }]}>
                COOK
              </Text>
              <Text style={[styles.metaValue, { color: ds.colors.textPrimary }]}>
                {recipe.cook_time || 0} min
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: ds.colors.textTertiary }]}>
                SERVINGS
              </Text>
              <Text style={[styles.metaValue, { color: ds.colors.textPrimary }]}>
                {scaledServings}
              </Text>
            </View>
          </View>
        </View>

      {/* Servings Scale - Minimal (only for saved recipes) */}
      {isSavedRecipe && (
        <View style={styles.scaleSection}>
          <View style={[styles.formDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            SCALE RECIPE
          </Text>
          <View style={styles.scaleControls}>
            <TouchableOpacity
              testID="servings-decrease"
              onPress={() => setScaledServings(Math.max(1, scaledServings - 1))}
              style={[styles.scaleButton, { borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)' }]}
              activeOpacity={0.6}
              accessibilityLabel="Decrease servings"
              accessibilityHint="Double tap to decrease servings"
              accessibilityRole="button"
            >
              <Text style={[styles.scaleButtonText, { color: ds.colors.textPrimary }]}>−</Text>
            </TouchableOpacity>
            <View style={styles.scaleValue}>
              <Text style={[styles.scaleValueNumber, { color: ds.colors.textPrimary }]}>
                {scaledServings}
              </Text>
              <Text style={[styles.scaleValueLabel, { color: ds.colors.textSecondary }]}>
                servings
              </Text>
            </View>
            <TouchableOpacity
              testID="servings-increase"
              onPress={() => setScaledServings(Math.min(20, scaledServings + 1))}
              style={[styles.scaleButton, { borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)' }]}
              activeOpacity={0.6}
              accessibilityLabel="Increase servings"
              accessibilityHint="Double tap to increase servings"
              accessibilityRole="button"
            >
              <Text style={[styles.scaleButtonText, { color: ds.colors.textPrimary }]}>+</Text>
            </TouchableOpacity>
          </View>
          {scaleFactor !== 1 && (
            <TouchableOpacity
              testID="servings-reset"
              onPress={() => setScaledServings(originalServings)}
              style={styles.resetButton}
              accessibilityLabel="Reset servings"
              accessibilityHint={`Double tap to reset to ${originalServings} servings`}
              accessibilityRole="button"
            >
              <Text style={[styles.resetButtonText, { color: ds.colors.textSecondary }]}>
                Reset to {originalServings}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Recipe Metadata - Inline */}
      <View style={styles.infoSection}>
        {recipe.cuisine && (
          <Text style={[styles.infoText, { color: ds.colors.textSecondary }]}>
            {recipe.cuisine}
          </Text>
        )}
        {recipe.difficulty && (
          <Text style={[styles.infoText, { color: ds.colors.textSecondary }]}>
            {recipe.cuisine ? ' · ' : ''}{recipe.difficulty}
          </Text>
        )}
      </View>

      {/* Rating & Notes - Minimal */}
      {isSavedRecipe && (
        <>
          {'rating' in recipe && recipe.rating != null && recipe.rating > 0 && (
            <View style={[styles.ratingSection, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
              <Text style={[styles.ratingLabel, { color: ds.colors.textTertiary }]}>
                RATING
              </Text>
              <Text style={[styles.ratingValue, { color: ds.colors.textPrimary }]}>
                {recipe.rating}/5
              </Text>
            </View>
          )}
          {'notes' in recipe && recipe.notes && (
            <View style={[styles.notesSection, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
              <Text style={[styles.notesLabel, { color: ds.colors.textTertiary }]}>
                NOTES
              </Text>
              <Text style={[styles.notesText, { color: ds.colors.textSecondary }]}>
                {recipe.notes}
              </Text>
            </View>
          )}
          <TouchableOpacity
            testID="edit-notes-rating-button"
            onPress={() => {
              setNotes('notes' in recipe ? (recipe.notes || '') : '');
              setRating('rating' in recipe ? (recipe.rating || 0) : 0);
              setEditDialogVisible(true);
            }}
            style={[styles.editRow, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}
            activeOpacity={0.6}
            accessibilityLabel={('notes' in recipe && recipe.notes) || ('rating' in recipe && recipe.rating) ? 'Edit notes and rating' : 'Add notes and rating'}
            accessibilityHint="Double tap to edit notes and rating"
            accessibilityRole="button"
          >
            <Text style={[styles.editText, { color: ds.colors.textPrimary }]}>
              {('notes' in recipe && recipe.notes) || ('rating' in recipe && recipe.rating) 
                ? 'Edit Notes & Rating' 
                : 'Add Notes & Rating'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={ds.colors.textTertiary} style={{ opacity: 0.4 }} />
          </TouchableOpacity>
        </>
      )}

      {/* Ingredients Section */}
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="format-list-bulleted" size={24} color={ds.colors.primary} />
        <Text style={[styles.sectionTitle, getTextStyle('headline', ds.colors.textPrimary, isDark)]}>Ingredients</Text>
      </View>
      <Card style={[styles.modernIngredientsCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
        <Card.Content style={styles.ingredientsTableContent}>
          {ingredients.map((ing, i) => {
            const rawItemName = typeof ing === 'string' ? ing : ing.item || ing.name || JSON.stringify(ing);
            const itemName = cleanIngredientName(rawItemName);
            const originalAmount = typeof ing === 'object' ? ing.amount : undefined;
            const scaledAmount = isSavedRecipe && scaleFactor !== 1 && originalAmount 
              ? scaleAmount(originalAmount)
              : originalAmount;
            
            return (
              <View key={i} style={[styles.modernIngredientRow, { borderBottomColor: ds.colors.surfaceHover }]}>
                <View style={styles.modernIngredientNameColumn}>
                  <View style={[styles.ingredientBullet, { backgroundColor: ds.colors.primary }]} />
                  <Text style={[styles.modernIngredientName, getTextStyle('body', ds.colors.textPrimary, isDark)]}>{itemName}</Text>
                </View>
                <View style={styles.modernIngredientAmountColumn}>
                  {scaledAmount ? (
                    <View style={styles.amountContainer}>
                      <Text style={[styles.modernAmountText, getTextStyle('body', ds.colors.textPrimary, isDark)]}>{scaledAmount}</Text>
                      {isSavedRecipe && scaleFactor !== 1 && originalAmount && originalAmount !== scaledAmount && (
                        <Text style={[styles.modernOriginalAmount, getTextStyle('caption', ds.colors.textTertiary, isDark)]}>(was {originalAmount})</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.modernAmountText, getTextStyle('body', ds.colors.textPrimary, isDark)]}>—</Text>
                  )}
                </View>
              </View>
            );
          })}
        </Card.Content>
      </Card>

      {/* Why This Works - Flavor Chemistry Button */}
      {flavorPairings.length > 0 && (
        <TouchableOpacity
          onPress={() => setFlavorSheetVisible(true)}
          style={[
            styles.flavorButton,
            { 
              backgroundColor: `${ds.colors.accent}10`,
              borderColor: ds.colors.accent,
            }
          ]}
          activeOpacity={0.7}
          accessibilityLabel="Why this works"
          accessibilityHint="Double tap to see flavor science"
          accessibilityRole="button"
        >
          <View style={[styles.flavorIconContainer, { backgroundColor: `${ds.colors.accent}15` }]}>
            <MaterialCommunityIcons name="flask-outline" size={20} color={ds.colors.accent} />
          </View>
          <View style={styles.flavorTextContainer}>
            <Text style={[styles.flavorButtonTitle, { color: ds.colors.textPrimary }]}>
              Why This Works
            </Text>
            <Text style={[styles.flavorButtonSubtitle, { color: ds.colors.textSecondary }]}>
              Discover the flavor science
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={ds.colors.textTertiary} />
        </TouchableOpacity>
      )}

      <Divider style={styles.divider} />

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Instructions
      </Text>
      {instructions.map((step, i) => (
        <Card key={i} style={[styles.modernInstructionCard, { backgroundColor: ds.colors.surface, ...ds.shadows.sm }]}>
          <Card.Content style={styles.instructionContent}>
            <View style={[styles.instructionNumber, { backgroundColor: ds.colors.primary }]}>
              <Text style={[styles.instructionNumberText, getTextStyle('label', ds.colors.surface, isDark)]}>{i + 1}</Text>
            </View>
            <Text style={[styles.modernInstructionText, getTextStyle('body', ds.colors.textPrimary, isDark)]}>
              {typeof step === 'string' ? step : JSON.stringify(step)}
            </Text>
          </Card.Content>
        </Card>
      ))}

      {'missing_ingredients' in recipe && recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
        <>
          <Divider style={styles.divider} />
          <Card style={styles.missingCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.missingTitle}>
                Missing Ingredients
              </Text>
              {recipe.missing_ingredients.map((item: string, i: number) => (
                <Text key={i} variant="bodyMedium" style={styles.missingItem}>
                  • {item}
                </Text>
              ))}
              <TouchableOpacity
                style={[
                  styles.instacartButton,
                  { 
                    backgroundColor: '#F5E6D3', // Cashew - approved Instacart background color
                    borderColor: isDark ? 'rgba(0, 168, 98, 0.3)' : 'rgba(0, 168, 98, 0.2)'
                  }
                ]}
                onPress={() => instacartService.shopMissingIngredients(recipe as Recipe, setInstacartLoading)}
                disabled={instacartLoading}
                activeOpacity={0.7}
                accessibilityLabel="Shop missing ingredients on Instacart"
                accessibilityHint="Double tap to open Instacart with missing ingredients"
                accessibilityRole="button"
              >
                {instacartLoading ? (
                  <ActivityIndicator size="small" color={INSTACART_GREEN} />
                ) : (
                  <InstacartLogo width={120} height={20} />
                )}
              </TouchableOpacity>
            </Card.Content>
          </Card>
        </>
      )}

      {/* Calculated Missing Ingredients - for saved recipes */}
      {isSavedRecipe && !('missing_ingredients' in recipe && recipe.missing_ingredients && recipe.missing_ingredients.length > 0) && (
        <>
          {loadingMissing ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={ds.colors.textTertiary} />
              <Text style={{ color: ds.colors.textTertiary, marginTop: 8, fontSize: 13 }}>
                Checking your pantry...
              </Text>
            </View>
          ) : calculatedMissingIngredients.length > 0 ? (
            <>
              <Divider style={styles.divider} />
              <Card style={styles.missingCard}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.missingTitle}>
                    Missing Ingredients
                  </Text>
                  {calculatedMissingIngredients.map((item: string, i: number) => (
                    <Text key={i} variant="bodyMedium" style={styles.missingItem}>
                      • {item}
                    </Text>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.instacartButton,
                      { 
                        backgroundColor: '#F5E6D3', // Cashew - approved Instacart background color
                        borderColor: isDark ? 'rgba(0, 168, 98, 0.3)' : 'rgba(0, 168, 98, 0.2)'
                      }
                    ]}
                    onPress={() => {
                      // Create a temporary recipe object with calculated missing ingredients
                      const recipeWithMissing = {
                        ...recipe,
                        missing_ingredients: calculatedMissingIngredients,
                      };
                      instacartService.shopMissingIngredients(recipeWithMissing as Recipe, setInstacartLoading);
                    }}
                    disabled={instacartLoading}
                    activeOpacity={0.7}
                    accessibilityLabel="Shop missing ingredients on Instacart"
                    accessibilityHint="Double tap to open Instacart with missing ingredients"
                    accessibilityRole="button"
                  >
                    {instacartLoading ? (
                      <ActivityIndicator size="small" color={INSTACART_GREEN} />
                    ) : (
                      <InstacartLogo width={120} height={20} />
                    )}
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            </>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ color: ds.colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                You have all the ingredients for this recipe!
              </Text>
            </View>
          )}
        </>
      )}

      {/* Edit Notes & Rating Dialog */}
      {isSavedRecipe && (
        <Portal>
          <Dialog 
            visible={editDialogVisible} 
            onDismiss={() => {
              Keyboard.dismiss();
              setEditDialogVisible(false);
            }}
            style={styles.dialog}
            dismissable={true}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardAvoidingView}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <Dialog.Title style={styles.dialogTitle}>Edit Notes & Rating</Dialog.Title>
              <Dialog.Content style={styles.dialogContent}>
                <ScrollView 
                  contentContainerStyle={styles.dialogScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <Text variant="bodyMedium" style={{ marginBottom: 8, fontWeight: '600' }}>
                    Rating: {Math.round(rating)}/5
                  </Text>
                  <Slider
                    value={rating}
                    onValueChange={(value) => setRating(Math.round(value))}
                    minimumValue={0}
                    maximumValue={5}
                    step={1}
                    minimumTrackTintColor="#0284c7"
                    maximumTrackTintColor="#d1d5db"
                    thumbTintColor="#0284c7"
                    style={{ marginBottom: 32, width: '100%', height: 40 }}
                  />
                  <View style={styles.notesSection}>
                    <View style={styles.notesHeader}>
                      <Text variant="bodyMedium" style={{ fontWeight: '600', flex: 1 }}>
                        Notes
                      </Text>
                      {keyboardVisible && (
                        <Button
                          mode="text"
                          onPress={Keyboard.dismiss}
                          compact
                          style={styles.doneButton}
                          accessibilityLabel="Done"
                          accessibilityHint="Double tap to dismiss keyboard"
                          accessibilityRole="button"
                        >
                          Done
                        </Button>
                      )}
                    </View>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={12}
                      mode="outlined"
                      placeholder="Add your personal notes about this recipe..."
                      blurOnSubmit={false}
                      style={styles.notesInput}
                      contentStyle={styles.notesInputContent}
                      accessibilityLabel="Recipe notes"
                      accessibilityHint="Type your personal notes for this recipe"
                    />
                  </View>
                  {/* Spacer to ensure buttons are accessible when keyboard is visible */}
                  {keyboardVisible && <View style={{ height: 150 }} />}
                </ScrollView>
              </Dialog.Content>
              <Dialog.Actions style={styles.dialogActions}>
                <Button 
                  testID="edit-notes-cancel"
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditDialogVisible(false);
                  }}
                  style={styles.actionButton}
                  accessibilityLabel="Cancel"
                  accessibilityHint="Double tap to cancel without saving"
                  accessibilityRole="button"
                >
                  Cancel
                </Button>
                <Button
                  testID="edit-notes-save"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSaveNotesRating();
                  }}
                  mode="contained"
                  loading={saving}
                  disabled={saving}
                  style={styles.actionButton}
                  accessibilityLabel="Save"
                  accessibilityHint="Double tap to save notes and rating"
                  accessibilityRole="button"
                >
                  Save
                </Button>
              </Dialog.Actions>
            </KeyboardAvoidingView>
          </Dialog>
        </Portal>
      )}

      {/* Flavor Chemistry Bottom Sheet */}
      <FlavorChemistrySheet
        visible={flavorSheetVisible}
        onDismiss={() => setFlavorSheetVisible(false)}
        flavorPairings={flavorPairings}
        recipeName={recipe.name}
      />
      </ScreenContentWrapper>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  headerShareButton: {
    padding: 8,
    marginRight: 8,
  },
  // Hero Section - Minimal
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginBottom: 12,
    lineHeight: 38,
  },
  heroDescription: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.6,
    letterSpacing: -0.2,
  },
  // Meta Section - Minimal inline
  metaSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.55,
  },
  metaValue: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  // Scale Section - Minimal
  scaleSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  formDivider: {
    height: 1,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 16,
    opacity: 0.55,
  },
  scaleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  scaleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  scaleValue: {
    alignItems: 'center',
    minWidth: 100,
  },
  scaleValueNumber: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  scaleValueLabel: {
    fontSize: 13,
    opacity: 0.6,
  },
  resetButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  // Info Section
  infoSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.6,
    letterSpacing: -0.1,
    textTransform: 'capitalize',
  },
  // Rating Section
  ratingSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  ratingLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.55,
  },
  ratingValue: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // Notes Section
  notesSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  notesLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.55,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.7,
    letterSpacing: -0.1,
  },
  // Edit Row
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  editText: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: DesignSystem.spacing.lg,
    marginBottom: DesignSystem.spacing.md,
    gap: DesignSystem.spacing.sm,
  },
  sectionTitle: {
  },
  divider: {
    marginVertical: DesignSystem.spacing.lg,
  },
  // Modern Ingredients Table
  modernIngredientsCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ingredientsTableCard: {
    marginBottom: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.lg,
    ...DesignSystem.shadows.md,
  },
  ingredientsTableContent: {
    padding: 0,
  },
  modernIngredientRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modernIngredientNameColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: DesignSystem.spacing.md,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  modernIngredientName: {
    flex: 1,
  },
  modernIngredientAmountColumn: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  modernAmountText: {
    textAlign: 'right',
    fontWeight: '600',
  },
  modernOriginalAmount: {
    textAlign: 'right',
    fontStyle: 'italic',
    marginTop: 2,
  },
  // Legacy styles
  ingredientCard: {
    marginBottom: DesignSystem.spacing.sm,
    ...DesignSystem.shadows.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    paddingVertical: DesignSystem.spacing.sm,
    borderBottomWidth: 1,
  },
  ingredientNameColumn: {
    flex: 1,
    paddingRight: DesignSystem.spacing.md,
  },
  ingredientAmountColumn: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  amountText: {
    textAlign: 'right',
  },
  // Modern Instruction Cards
  modernInstructionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  instructionContent: {
    flexDirection: 'row',
    padding: DesignSystem.spacing.md,
    gap: DesignSystem.spacing.md,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    fontWeight: '700',
  },
  modernInstructionText: {
    flex: 1,
    lineHeight: 24,
  },
  // Legacy instruction card
  instructionCard: {
    marginBottom: DesignSystem.spacing.sm,
    ...DesignSystem.shadows.sm,
  },
  // Missing Ingredients
  missingCard: {
    borderLeftWidth: 4,
    marginTop: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.lg,
    ...DesignSystem.shadows.sm,
  },
  missingTitle: {
    marginBottom: DesignSystem.spacing.sm,
  },
  missingItem: {
  },
  // Instacart Button
  instacartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    borderWidth: 1,
    // borderColor is set inline to be theme-aware
  },
  instacartButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Notes Card
  modernNotesCard: {
    marginTop: DesignSystem.spacing.md,
    marginBottom: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.lg,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.sm,
    gap: DesignSystem.spacing.sm,
  },
  notesTitle: {
  },
  notesText: {
    lineHeight: 22,
  },
  // Legacy notes card
  notesCard: {
    marginTop: DesignSystem.spacing.sm,
    marginBottom: DesignSystem.spacing.sm,
    ...DesignSystem.shadows.sm,
  },
  // Edit Button
  modernEditButton: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  modernEditButtonLabel: {
    fontWeight: '600',
  },
  editButtonContainer: {
    marginTop: DesignSystem.spacing.sm,
    marginBottom: DesignSystem.spacing.sm,
  },
  editButton: {
    marginTop: DesignSystem.spacing.sm,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  dialog: {
    maxHeight: '90%',
    height: '90%',
    marginHorizontal: 10,
    marginVertical: 20,
  },
  dialogTitle: {
    paddingBottom: 8,
  },
  dialogContent: {
    flex: 1,
    paddingHorizontal: 0,
    maxHeight: '100%',
  },
  dialogScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexGrow: 1,
  },
  notesSection: {
    marginTop: 8,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  doneButton: {
    marginLeft: 8,
  },
  notesInput: {
    minHeight: 250,
    maxHeight: 450,
  },
  notesInputContent: {
    minHeight: 250,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    minHeight: 56,
    maxHeight: 56,
  },
  actionButton: {
    minWidth: 80,
  },
  // Modern Scale Card
  modernScaleCard: {
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    borderLeftWidth: 4,
  },
  scaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.md,
    gap: DesignSystem.spacing.sm,
  },
  scaleHeaderText: {
    flex: 1,
  },
  scaleTitle: {
    marginBottom: 2,
  },
  scaleSubtitle: {
  },
  scalePercentage: {
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.md,
  },
  sliderLabel: {
    minWidth: 24,
    textAlign: 'center',
  },
  servingsSlider: {
    flex: 1,
    marginHorizontal: DesignSystem.spacing.md,
    height: 40,
  },
  scaleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: DesignSystem.spacing.sm,
  },
  modernScaleButton: {
    flex: 1,
    borderRadius: DesignSystem.borderRadius.md,
  },
  modernScaleButtonLabel: {
  },
  scaleButton: {
    flex: 1,
  },
  originalAmount: {
    fontStyle: 'italic',
  },
  // Flavor Chemistry Button
  flavorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  flavorIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flavorTextContainer: {
    flex: 1,
  },
  flavorButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  flavorButtonSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});

