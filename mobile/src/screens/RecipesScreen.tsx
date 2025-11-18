import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  TextInput,
  Checkbox,
  ActivityIndicator,
  ProgressBar,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import type { Recipe, InventoryItem } from '../types';

export default function RecipesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [numRecipes, setNumRecipes] = useState(5);
  const [requiredIngredients, setRequiredIngredients] = useState<string[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
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
      Alert.alert('Error', err.message || 'Failed to load ingredients');
    }
  };

  const handleGenerateRecipes = async () => {
    try {
      setGenerating(true);
      setProgress(0);
      setRecipes([]);

      const newRecipes: Recipe[] = [];
      const avoidNames: string[] = [];

      for (let i = 0; i < numRecipes; i++) {
        setProgress(((i + 1) / numRecipes) * 100);

        const recipe = await apiClient.generateSingleRecipe({
          required_ingredients: requiredIngredients.length > 0 ? requiredIngredients : undefined,
          excluded_ingredients: excludedIngredients.length > 0 ? excludedIngredients : undefined,
          avoid_names: avoidNames,
          allow_missing_ingredients: allowMissing,
        });

        newRecipes.push(recipe);
        if (recipe.name) avoidNames.push(recipe.name);
        setRecipes([...newRecipes]);
      }

      setProgress(100);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate recipes');
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
      Alert.alert('Success', `Saved "${recipe.name}" to recipe box!`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save recipe');
    }
  };

  const toggleIngredient = (ingredient: string, list: string[], setList: (list: string[]) => void) => {
    if (list.includes(ingredient)) {
      setList(list.filter((i) => i !== ingredient));
    } else {
      setList([...list, ingredient]);
    }
  };

  if (availableIngredients.length === 0) {
    return (
      <View style={styles.center}>
        <Text variant="bodyLarge">No items in stock. Add items to your pantry first!</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text variant="titleLarge" style={styles.title}>
        Recipe Suggestions
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Options
          </Text>

          <TextInput
            label="Number of Recipes"
            value={numRecipes.toString()}
            onChangeText={(text) => {
              // Allow empty text for clearing
              if (text === '' || text === null || text === undefined) {
                setNumRecipes(0);
              } else {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num > 0) {
                  setNumRecipes(num);
                }
              }
            }}
            keyboardType="numeric"
            style={styles.input}
            placeholder="5"
          />

          <View style={styles.checkboxContainer}>
            <Checkbox
              status={allowMissing ? 'checked' : 'unchecked'}
              onPress={() => setAllowMissing(!allowMissing)}
            />
            <Text 
              variant="bodyMedium" 
              onPress={() => setAllowMissing(!allowMissing)}
              style={styles.checkboxLabel}
            >
              Allow Missing Ingredients
            </Text>
          </View>

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Required Ingredients
          </Text>
          <View style={styles.chipContainer}>
            {availableIngredients.map((ing) => (
              <Chip
                key={ing}
                selected={requiredIngredients.includes(ing)}
                onPress={() => toggleIngredient(ing, requiredIngredients, setRequiredIngredients)}
                style={styles.chip}
              >
                {ing}
              </Chip>
            ))}
          </View>

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Excluded Ingredients
          </Text>
          <View style={styles.chipContainer}>
            {availableIngredients.map((ing) => (
              <Chip
                key={ing}
                selected={excludedIngredients.includes(ing)}
                onPress={() => toggleIngredient(ing, excludedIngredients, setExcludedIngredients)}
                style={styles.chip}
              >
                {ing}
              </Chip>
            ))}
          </View>

          <Button
            mode="contained"
            onPress={handleGenerateRecipes}
            disabled={generating}
            style={styles.generateButton}
          >
            {generating ? 'Generating...' : 'Generate Recipes'}
          </Button>

          {generating && (
            <View style={styles.progressContainer}>
              <ProgressBar progress={progress / 100} color="#0284c7" />
              <Text variant="bodySmall" style={styles.progressText}>
                Generating recipe {recipes.length + 1} of {numRecipes}...
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {recipes.map((recipe, idx) => (
        <Card
          key={idx}
          style={styles.card}
        >
          <Card.Content>
            <Text variant="titleLarge">{recipe.name}</Text>
            {recipe.description && (
              <Text variant="bodyMedium" style={styles.description}>
                {recipe.description}
              </Text>
            )}
            <View style={styles.recipeMeta}>
              <Text variant="bodySmall">⏱️ {recipe.prep_time} min prep</Text>
              <Text variant="bodySmall">🔥 {recipe.cook_time} min cook</Text>
              <Text variant="bodySmall">👥 {recipe.servings} servings</Text>
            </View>
            {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
              <View style={styles.missingContainer}>
                <Text variant="bodySmall" style={styles.missingTitle}>
                  Missing: {recipe.missing_ingredients.join(', ')}
                </Text>
              </View>
            )}
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('RecipeDetail', { recipe } as never)}
                style={[styles.viewButton, { marginRight: 8 }]}
              >
                View Details
              </Button>
              <Button
                mode="outlined"
                onPress={() => handleSaveRecipe(recipe)}
                style={styles.saveButton}
              >
                Save Recipe
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#111827',
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxLabel: {
    marginLeft: 8,
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  generateButton: {
    marginTop: 16,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressText: {
    marginTop: 8,
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    color: '#6b7280',
  },
  recipeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    marginBottom: 8,
  },
  missingContainer: {
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  missingTitle: {
    color: '#ea580c',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  viewButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});

