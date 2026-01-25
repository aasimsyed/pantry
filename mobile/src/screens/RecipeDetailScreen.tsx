import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Card, Text, Divider, Button, TextInput, Portal, Dialog } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import type { Recipe, RecentRecipe, SavedRecipe } from '../types';

type RouteParams = {
  RecipeDetail: {
    recipe: Recipe | RecentRecipe | SavedRecipe;
  };
};

export default function RecipeDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'RecipeDetail'>>();
  const navigation = useNavigation();
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
      <Text variant="headlineMedium" style={styles.title}>
        {recipe.name}
      </Text>

      {recipe.description && (
        <Text variant="bodyLarge" style={styles.description}>
          {recipe.description}
        </Text>
      )}

      <View style={styles.meta}>
        <Text variant="bodyMedium">⏱️ Prep: {recipe.prep_time || 0} min</Text>
        <Text variant="bodyMedium">🔥 Cook: {recipe.cook_time || 0} min</Text>
        <Text variant="bodyMedium">👥 Serves: {scaledServings}</Text>
      </View>

      {/* Servings Scale Control - only for saved recipes */}
      {isSavedRecipe && (
        <Card style={styles.scaleCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.scaleTitle}>
              📏 Scale Recipe
            </Text>
            <Text variant="bodySmall" style={styles.scaleSubtitle}>
              Adjust servings: {scaledServings} {scaledServings === 1 ? 'serving' : 'servings'}
              {scaleFactor !== 1 && ` (${scaleFactor > 1 ? '+' : ''}${((scaleFactor - 1) * 100).toFixed(0)}%)`}
            </Text>
            <View style={styles.sliderContainer}>
              <Text variant="bodySmall" style={styles.sliderLabel}>1</Text>
              <Slider
                value={scaledServings}
                onValueChange={(value) => setScaledServings(Math.round(value))}
                minimumValue={1}
                maximumValue={20}
                step={1}
                minimumTrackTintColor="#0284c7"
                maximumTrackTintColor="#d1d5db"
                thumbTintColor="#0284c7"
                style={styles.servingsSlider}
              />
              <Text variant="bodySmall" style={styles.sliderLabel}>20</Text>
            </View>
            <View style={styles.scaleButtons}>
              <Button
                mode="outlined"
                compact
                onPress={() => setScaledServings(Math.max(1, scaledServings - 1))}
                style={styles.scaleButton}
              >
                -1
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => setScaledServings(originalServings)}
                style={styles.scaleButton}
              >
                Reset ({originalServings})
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => setScaledServings(Math.min(20, scaledServings + 1))}
                style={styles.scaleButton}
              >
                +1
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {'cuisine' in recipe && recipe.cuisine && (
        <Text variant="bodyMedium" style={styles.cuisine}>
          🌍 {recipe.cuisine} Cuisine
        </Text>
      )}

      {isSavedRecipe && (
        <>
          {'rating' in recipe && recipe.rating != null && recipe.rating > 0 && (
            <View style={styles.ratingContainer}>
              <Text variant="bodyMedium" style={styles.ratingText}>
                ⭐ Rating: {recipe.rating}/5
              </Text>
            </View>
          )}
          {'notes' in recipe && recipe.notes && (
            <Card style={styles.notesCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.notesTitle}>📝 Notes</Text>
                <Text variant="bodyMedium" style={styles.notesText}>{recipe.notes}</Text>
              </Card.Content>
            </Card>
          )}
          <View style={styles.editButtonContainer}>
            <Button
              mode="outlined"
              onPress={() => {
                setNotes('notes' in recipe ? (recipe.notes || '') : '');
                setRating('rating' in recipe ? (recipe.rating || 0) : 0);
                setEditDialogVisible(true);
              }}
              style={styles.editButton}
            >
              {('notes' in recipe && recipe.notes) || ('rating' in recipe && recipe.rating) ? 'Edit Notes & Rating' : 'Add Notes & Rating'}
            </Button>
          </View>
        </>
      )}

      <Divider style={styles.divider} />

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Ingredients
      </Text>
      <Card style={styles.ingredientsTableCard}>
        <Card.Content>
          {ingredients.map((ing, i) => {
            const rawItemName = typeof ing === 'string' ? ing : ing.item || ing.name || JSON.stringify(ing);
            const itemName = cleanIngredientName(rawItemName);
            const originalAmount = typeof ing === 'object' ? ing.amount : undefined;
            const scaledAmount = isSavedRecipe && scaleFactor !== 1 && originalAmount 
              ? scaleAmount(originalAmount)
              : originalAmount;
            
            return (
              <View key={i} style={styles.ingredientRow}>
                <View style={styles.ingredientNameColumn}>
                  <Text variant="bodyMedium">{itemName}</Text>
                </View>
                <View style={styles.ingredientAmountColumn}>
                  {scaledAmount ? (
                    <View>
                      <Text variant="bodyMedium" style={styles.amountText}>
                        {scaledAmount}
                      </Text>
                      {isSavedRecipe && scaleFactor !== 1 && originalAmount && originalAmount !== scaledAmount && (
                        <Text variant="bodySmall" style={styles.originalAmount}>
                          (was {originalAmount})
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text variant="bodyMedium" style={styles.amountText}>—</Text>
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
        <Card key={i} style={styles.instructionCard}>
          <Card.Content>
            <Text variant="bodyMedium">
              {i + 1}. {typeof step === 'string' ? step : JSON.stringify(step)}
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
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditDialogVisible(false);
                  }}
                  style={styles.actionButton}
                >
                  Cancel
                </Button>
                <Button
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
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111827',
  },
  description: {
    marginBottom: 16,
    color: '#6b7280',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  cuisine: {
    marginBottom: 16,
    color: '#6b7280',
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },
  ingredientCard: {
    marginBottom: 8,
    elevation: 1,
  },
  ingredientsTableCard: {
    marginBottom: 8,
    elevation: 1,
  },
  ingredientRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  ingredientNameColumn: {
    flex: 1,
    paddingRight: 12,
  },
  ingredientAmountColumn: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  amountText: {
    textAlign: 'right',
  },
  instructionCard: {
    marginBottom: 8,
    elevation: 1,
  },
  missingCard: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
    marginTop: 8,
  },
  missingTitle: {
    fontWeight: '600',
    color: '#ea580c',
    marginBottom: 8,
  },
  missingItem: {
    color: '#ea580c',
  },
  ratingContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  ratingText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  notesCard: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  notesTitle: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  notesText: {
    color: '#6b7280',
  },
  editButtonContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  editButton: {
    marginTop: 8,
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
  scaleCard: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
  },
  scaleTitle: {
    fontWeight: '600',
    marginBottom: 4,
    color: '#0284c7',
  },
  scaleSubtitle: {
    color: '#64748b',
    marginBottom: 12,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    color: '#64748b',
    minWidth: 20,
    textAlign: 'center',
  },
  servingsSlider: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
  },
  scaleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  scaleButton: {
    flex: 1,
  },
  originalAmount: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});

