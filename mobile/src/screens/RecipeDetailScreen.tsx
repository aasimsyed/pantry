import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
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
      const updated = await apiClient.updateSavedRecipe(
        recipe.id,
        notes || undefined,
        rating > 0 ? rating : undefined,
        undefined // tags not editable here
      );
      setRecipe(updated);
      setEditDialogVisible(false);
      Alert.alert('Success', 'Recipe updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update recipe');
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
        <Text variant="bodyMedium">👥 Serves: {recipe.servings || 4}</Text>
      </View>

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
      {ingredients.map((ing, i) => (
        <Card key={i} style={styles.ingredientCard}>
          <Card.Content>
            <Text variant="bodyMedium">
              • {typeof ing === 'string' ? ing : ing.item || ing.name || JSON.stringify(ing)}
              {typeof ing === 'object' && ing.amount && `: ${ing.amount}`}
            </Text>
          </Card.Content>
        </Card>
      ))}

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
          <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
            <Dialog.Title>Edit Notes & Rating</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{ marginBottom: 8 }}>Rating: {Math.round(rating)}/5</Text>
              <Slider
                value={rating}
                onValueChange={(value) => setRating(Math.round(value))}
                minimumValue={0}
                maximumValue={5}
                step={1}
                minimumTrackTintColor="#0284c7"
                maximumTrackTintColor="#d1d5db"
                thumbTintColor="#0284c7"
                style={{ marginBottom: 24, width: '100%', height: 40 }}
              />
              <TextInput
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                mode="outlined"
                placeholder="Add your personal notes about this recipe..."
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
              <Button
                onPress={handleSaveNotesRating}
                mode="contained"
                loading={saving}
                disabled={saving}
              >
                Save
              </Button>
            </Dialog.Actions>
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
});

