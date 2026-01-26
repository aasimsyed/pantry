import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Card, Text, Divider, Button, TextInput, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { DesignSystem, getDesignSystem, getTextStyle } from '../utils/designSystem';
import type { Recipe, RecentRecipe, SavedRecipe } from '../types';

type RouteParams = {
  RecipeDetail: {
    recipe: Recipe | RecentRecipe | SavedRecipe;
  };
};

export default function RecipeDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'RecipeDetail'>>();
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const { recipe: initialRecipe } = route.params;
  const [recipe, setRecipe] = useState(initialRecipe);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [notes, setNotes] = useState('notes' in recipe ? (recipe.notes || '') : '');
  const [rating, setRating] = useState('rating' in recipe ? (recipe.rating || 0) : 0);
  const [saving, setSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [scaledServings, setScaledServings] = useState(recipe.servings || 4);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text testID="recipe-detail-title" style={[styles.heroTitle, { color: ds.colors.textPrimary }]}>{recipe.name}</Text>
          {recipe.description && (
            <Text testID="recipe-detail-description" style={[styles.heroDescription, { color: ds.colors.textSecondary }]}>{recipe.description}</Text>
          )}
        </View>

        {/* Meta Information Cards */}
        <View style={styles.metaGrid}>
          <View style={[styles.metaCard, { backgroundColor: ds.colors.surface, ...ds.shadows.sm }]}>
            <MaterialCommunityIcons name="timer-outline" size={24} color={ds.colors.primary} />
            <Text style={[styles.metaValue, getTextStyle('title', ds.colors.textPrimary, isDark)]}>{recipe.prep_time || 0}</Text>
            <Text style={[styles.metaLabel, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>Prep (min)</Text>
          </View>
          <View style={[styles.metaCard, { backgroundColor: ds.colors.surface, ...ds.shadows.sm }]}>
            <MaterialCommunityIcons name="fire" size={24} color={ds.colors.accent} />
            <Text style={[styles.metaValue, getTextStyle('title', ds.colors.textPrimary, isDark)]}>{recipe.cook_time || 0}</Text>
            <Text style={[styles.metaLabel, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>Cook (min)</Text>
          </View>
          <View style={[styles.metaCard, { backgroundColor: ds.colors.surface, ...ds.shadows.sm }]}>
            <MaterialCommunityIcons name="account-group" size={24} color={ds.colors.success} />
            <Text style={[styles.metaValue, getTextStyle('title', ds.colors.textPrimary, isDark)]}>{scaledServings}</Text>
            <Text style={[styles.metaLabel, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>Serves</Text>
          </View>
        </View>

      {/* Servings Scale Control - only for saved recipes */}
      {isSavedRecipe && (
        <Card style={[styles.modernScaleCard, { backgroundColor: `${ds.colors.primary}08`, borderLeftColor: ds.colors.primary, ...ds.shadows.sm }]}>
          <Card.Content>
            <View style={styles.scaleHeader}>
              <MaterialCommunityIcons name="scale" size={24} color={ds.colors.primary} />
              <View style={styles.scaleHeaderText}>
                <Text style={[styles.scaleTitle, getTextStyle('title', ds.colors.primary, isDark)]}>Scale Recipe</Text>
                <Text style={[styles.scaleSubtitle, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>
                  {scaledServings} {scaledServings === 1 ? 'serving' : 'servings'}
                  {scaleFactor !== 1 && (
                    <Text style={[styles.scalePercentage, getTextStyle('caption', ds.colors.primary, isDark)]}>
                      {' '}({scaleFactor > 1 ? '+' : ''}{((scaleFactor - 1) * 100).toFixed(0)}%)
                    </Text>
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderLabel, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>1</Text>
              <Slider
                testID="recipe-servings-slider"
                value={scaledServings}
                onValueChange={(value) => setScaledServings(Math.round(value))}
                minimumValue={1}
                maximumValue={20}
                step={1}
                minimumTrackTintColor={ds.colors.primary}
                maximumTrackTintColor={ds.colors.surfaceHover}
                thumbTintColor={ds.colors.primary}
                style={styles.servingsSlider}
              />
              <Text style={[styles.sliderLabel, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>20</Text>
            </View>
            <View style={styles.scaleButtons}>
              <Button
                testID="servings-decrease"
                mode="outlined"
                compact
                onPress={() => setScaledServings(Math.max(1, scaledServings - 1))}
                style={[styles.modernScaleButton, { borderColor: ds.colors.primary }]}
                labelStyle={[styles.modernScaleButtonLabel, getTextStyle('label', ds.colors.primary, isDark)]}
              >
                -1
              </Button>
              <Button
                testID="servings-reset"
                mode="outlined"
                compact
                onPress={() => setScaledServings(originalServings)}
                style={[styles.modernScaleButton, { borderColor: ds.colors.primary }]}
                labelStyle={[styles.modernScaleButtonLabel, getTextStyle('label', ds.colors.primary, isDark)]}
              >
                Reset
              </Button>
              <Button
                testID="servings-increase"
                mode="outlined"
                compact
                onPress={() => setScaledServings(Math.min(20, scaledServings + 1))}
                style={[styles.modernScaleButton, { borderColor: ds.colors.primary }]}
                labelStyle={[styles.modernScaleButtonLabel, getTextStyle('label', ds.colors.primary, isDark)]}
              >
                +1
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Cuisine Badge */}
      {'cuisine' in recipe && recipe.cuisine && (
        <View style={[styles.cuisineBadge, { backgroundColor: ds.colors.surfaceHover }]}>
          <MaterialCommunityIcons name="earth" size={18} color={ds.colors.accent} />
          <Text style={[styles.cuisineText, getTextStyle('label', ds.colors.textPrimary, isDark)]}>{recipe.cuisine} Cuisine</Text>
        </View>
      )}

      {/* Rating & Notes Section */}
      {isSavedRecipe && (
        <>
          {'rating' in recipe && recipe.rating != null && recipe.rating > 0 && (
            <View style={[styles.ratingBadge, { backgroundColor: `${ds.colors.warning}15` }]}>
              <MaterialCommunityIcons name="star" size={20} color={ds.colors.warning} />
              <Text style={[styles.ratingText, getTextStyle('label', ds.colors.warning, isDark)]}>Rating: {recipe.rating}/5</Text>
            </View>
          )}
          {'notes' in recipe && recipe.notes && (
            <Card style={[styles.modernNotesCard, { backgroundColor: ds.colors.surfaceHover, ...ds.shadows.sm }]}>
              <Card.Content>
                <View style={styles.notesHeader}>
                  <MaterialCommunityIcons name="note-text" size={20} color={ds.colors.primary} />
                  <Text style={[styles.notesTitle, getTextStyle('title', ds.colors.textPrimary, isDark)]}>Notes</Text>
                </View>
                <Text style={[styles.notesText, getTextStyle('body', ds.colors.textSecondary, isDark)]}>{recipe.notes}</Text>
              </Card.Content>
            </Card>
          )}
          <Button
            testID="edit-notes-rating-button"
            mode="outlined"
            icon="pencil"
            onPress={() => {
              setNotes('notes' in recipe ? (recipe.notes || '') : '');
              setRating('rating' in recipe ? (recipe.rating || 0) : 0);
              setEditDialogVisible(true);
            }}
            style={[styles.modernEditButton, { borderColor: ds.colors.primary }]}
            labelStyle={[styles.modernEditButtonLabel, getTextStyle('label', ds.colors.primary, isDark)]}
          >
            {('notes' in recipe && recipe.notes) || ('rating' in recipe && recipe.rating) 
              ? 'Edit Notes & Rating' 
              : 'Add Notes & Rating'}
          </Button>
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
              {recipe.missing_ingredients.map((item, i) => (
                <Text key={i} variant="bodyMedium" style={styles.missingItem}>
                  • {item}
                </Text>
              ))}
            </Card.Content>
          </Card>
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
                >
                  Save
                </Button>
              </Dialog.Actions>
            </KeyboardAvoidingView>
          </Dialog>
        </Portal>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: DesignSystem.spacing.md,
    paddingBottom: DesignSystem.spacing.xxl,
  },
  // Hero Section
  heroSection: {
    marginBottom: DesignSystem.spacing.lg,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: DesignSystem.spacing.sm,
    lineHeight: 34,
  },
  heroDescription: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.85,
  },
  // Meta Grid
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: DesignSystem.spacing.lg,
    gap: DesignSystem.spacing.sm,
  },
  metaCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  metaValue: {
    marginTop: 4,
    marginBottom: 2,
  },
  metaLabel: {
  },
  // Badges
  cuisineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    marginBottom: 16,
    gap: 4,
  },
  cuisineText: {
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    marginBottom: 16,
    gap: 4,
  },
  ratingText: {
    fontWeight: '600',
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
});

