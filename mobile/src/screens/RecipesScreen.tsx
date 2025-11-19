import React, { useState, useEffect, useCallback } from 'react';
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
  Menu,
  Divider,
  Portal,
  Dialog,
  Searchbar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import { PantrySelector } from '../components/PantrySelector';
import type { Recipe, InventoryItem } from '../types';

export default function RecipesScreen() {
  const navigation = useNavigation();
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [numRecipes, setNumRecipes] = useState(5);
  const [numRecipesText, setNumRecipesText] = useState('5');
  const [requiredIngredients, setRequiredIngredients] = useState<string[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [allowMissing, setAllowMissing] = useState(false);
  const [cuisine, setCuisine] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [cuisineMenuVisible, setCuisineMenuVisible] = useState(false);
  const [difficultyMenuVisible, setDifficultyMenuVisible] = useState(false);
  const [requiredIngredientsDialogVisible, setRequiredIngredientsDialogVisible] = useState(false);
  const [excludedIngredientsDialogVisible, setExcludedIngredientsDialogVisible] = useState(false);
  const [selectedPantryId, setSelectedPantryId] = useState<number | undefined>();

  // Load available ingredients from API
  const loadAvailableIngredients = useCallback(async () => {
    if (selectedPantryId === undefined) return;
    
    setLoadingIngredients(true);
    setIngredientsError(null);
    try {
      console.log('Loading ingredients from API...');
      const items = await apiClient.getInventory(0, 1000, undefined, 'in_stock', selectedPantryId);
      console.log(`Loaded ${items.length} inventory items`);
      const uniqueNames = new Set<string>();
      items.forEach((item) => {
        if (item.product_name) uniqueNames.add(item.product_name);
      });
      const ingredients = Array.from(uniqueNames).sort();
      console.log(`Extracted ${ingredients.length} unique ingredients:`, ingredients);
      setAvailableIngredients(ingredients);
      setIngredientsError(null);
    } catch (err: any) {
      console.error('Error loading ingredients:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load ingredients';
      setIngredientsError(errorMessage);
      setAvailableIngredients([]);
      // Don't show alert here - let the dialog show the error message
    } finally {
      setLoadingIngredients(false);
    }
  }, [selectedPantryId]);

  // Reload ingredients when screen comes into focus or pantry changes
  useFocusEffect(
    useCallback(() => {
      if (selectedPantryId !== undefined) {
        loadAvailableIngredients();
      }
    }, [loadAvailableIngredients, selectedPantryId])
  );

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
          cuisine: cuisine || undefined,
          difficulty: difficulty ? difficulty.toLowerCase() : undefined,
          dietary_restrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
          avoid_names: avoidNames,
          allow_missing_ingredients: allowMissing,
          pantry_id: selectedPantryId,
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
        ingredients: recipe.ingredients as any, // API expects arrays
        instructions: recipe.instructions as any, // API expects arrays
      });
      Alert.alert('Success', `Saved "${recipe.name}" to recipe box!`);
    } catch (err: any) {
      // Extract error message from API response
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save recipe';
      
      // Check if it's a duplicate error (409 Conflict)
      if (err.response?.status === 409 || errorMessage.includes('already saved')) {
        Alert.alert('Already Saved', errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  const toggleIngredient = (ingredient: string, list: string[], setList: (list: string[]) => void) => {
    if (list.includes(ingredient)) {
      setList(list.filter((i) => i !== ingredient));
    } else {
      setList([...list, ingredient]);
    }
  };

  const [requiredSearchQuery, setRequiredSearchQuery] = useState('');
  const [excludedSearchQuery, setExcludedSearchQuery] = useState('');

  const filteredRequiredIngredients = availableIngredients.filter((ing) =>
    ing.toLowerCase().includes(requiredSearchQuery.toLowerCase())
  );
  const filteredExcludedIngredients = availableIngredients.filter((ing) =>
    ing.toLowerCase().includes(excludedSearchQuery.toLowerCase())
  );

  if (selectedPantryId === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
          <Text variant="titleLarge" style={styles.title}>
            Recipe Suggestions
          </Text>
          <PantrySelector
            selectedPantryId={selectedPantryId}
            onPantryChange={setSelectedPantryId}
          />
          <Text variant="bodyLarge" style={{ marginTop: 16, textAlign: 'center' }}>
            Please select a pantry to view recipes
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loadingIngredients) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
          <Text variant="titleLarge" style={styles.title}>
            Recipe Suggestions
          </Text>
          <PantrySelector
            selectedPantryId={selectedPantryId}
            onPantryChange={setSelectedPantryId}
          />
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0284c7" />
            <Text variant="bodyLarge" style={{ marginTop: 16 }}>
              Loading ingredients...
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (ingredientsError && availableIngredients.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
          <Text variant="titleLarge" style={styles.title}>
            Recipe Suggestions
          </Text>
          <PantrySelector
            selectedPantryId={selectedPantryId}
            onPantryChange={setSelectedPantryId}
          />
          <View style={styles.center}>
            <Text variant="bodyLarge" style={{ color: '#dc2626', marginBottom: 16 }}>
              {ingredientsError}
            </Text>
            <Button mode="contained" onPress={loadAvailableIngredients}>
              Retry
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (availableIngredients.length === 0 && !loadingIngredients && selectedPantryId !== undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
          <Text variant="titleLarge" style={styles.title}>
            Recipe Suggestions
          </Text>
          <PantrySelector
            selectedPantryId={selectedPantryId}
            onPantryChange={setSelectedPantryId}
          />
          <View style={styles.center}>
            <Text variant="bodyLarge" style={{ marginTop: 16, textAlign: 'center' }}>
              No items in stock. Add items to your pantry first!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
      <Text variant="titleLarge" style={styles.title}>
        Recipe Suggestions
      </Text>

      <PantrySelector
        selectedPantryId={selectedPantryId}
        onPantryChange={setSelectedPantryId}
      />

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Options
          </Text>

          <TextInput
            label="Number of Recipes"
            value={numRecipesText}
            onChangeText={(text) => {
              // Allow empty text for clearing
              setNumRecipesText(text);
              if (text === '' || text === null || text === undefined) {
                // Keep text empty, but don't update numRecipes yet
                return;
              }
              const num = parseInt(text, 10);
              if (!isNaN(num) && num > 0) {
                setNumRecipes(num);
              }
            }}
            onBlur={() => {
              // When field loses focus, ensure we have a valid number
              if (numRecipesText === '' || isNaN(parseInt(numRecipesText, 10)) || parseInt(numRecipesText, 10) <= 0) {
                setNumRecipesText(numRecipes.toString());
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
            Cuisine Type (Optional)
          </Text>
          <Menu
            visible={cuisineMenuVisible}
            onDismiss={() => setCuisineMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setCuisineMenuVisible(true)}
                style={styles.selectButton}
              >
                {cuisine || 'Any Cuisine'}
              </Button>
            }
          >
            <Menu.Item onPress={() => { setCuisine(''); setCuisineMenuVisible(false); }} title="Any" />
            <Menu.Item onPress={() => { setCuisine('Italian'); setCuisineMenuVisible(false); }} title="Italian" />
            <Menu.Item onPress={() => { setCuisine('Mexican'); setCuisineMenuVisible(false); }} title="Mexican" />
            <Menu.Item onPress={() => { setCuisine('Asian'); setCuisineMenuVisible(false); }} title="Asian" />
            <Menu.Item onPress={() => { setCuisine('American'); setCuisineMenuVisible(false); }} title="American" />
            <Menu.Item onPress={() => { setCuisine('Mediterranean'); setCuisineMenuVisible(false); }} title="Mediterranean" />
            <Menu.Item onPress={() => { setCuisine('Indian'); setCuisineMenuVisible(false); }} title="Indian" />
            <Menu.Item onPress={() => { setCuisine('French'); setCuisineMenuVisible(false); }} title="French" />
            <Menu.Item onPress={() => { setCuisine('Thai'); setCuisineMenuVisible(false); }} title="Thai" />
            <Menu.Item onPress={() => { setCuisine('Japanese'); setCuisineMenuVisible(false); }} title="Japanese" />
            <Menu.Item onPress={() => { setCuisine('Chinese'); setCuisineMenuVisible(false); }} title="Chinese" />
          </Menu>

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Difficulty (Optional)
          </Text>
          <Menu
            visible={difficultyMenuVisible}
            onDismiss={() => setDifficultyMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setDifficultyMenuVisible(true)}
                style={styles.selectButton}
              >
                {difficulty || 'Any Difficulty'}
              </Button>
            }
          >
            <Menu.Item onPress={() => { setDifficulty(''); setDifficultyMenuVisible(false); }} title="Any" />
            <Menu.Item onPress={() => { setDifficulty('Easy'); setDifficultyMenuVisible(false); }} title="Easy" />
            <Menu.Item onPress={() => { setDifficulty('Medium'); setDifficultyMenuVisible(false); }} title="Medium" />
            <Menu.Item onPress={() => { setDifficulty('Hard'); setDifficultyMenuVisible(false); }} title="Hard" />
          </Menu>

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Dietary Restrictions (Optional)
          </Text>
          <View style={styles.chipContainer}>
            {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto', 'Paleo'].map((diet) => (
              <Chip
                key={diet}
                selected={dietaryRestrictions.includes(diet)}
                onPress={() => {
                  if (dietaryRestrictions.includes(diet)) {
                    setDietaryRestrictions(dietaryRestrictions.filter((d) => d !== diet));
                  } else {
                    setDietaryRestrictions([...dietaryRestrictions, diet]);
                  }
                }}
                style={styles.chip}
              >
                {diet}
              </Chip>
            ))}
          </View>

          <Divider style={styles.divider} />

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Required Ingredients
          </Text>
          <Button
            mode="outlined"
            onPress={async () => {
              setRequiredSearchQuery('');
              // Reload ingredients if empty or if there was an error
              if (availableIngredients.length === 0 || ingredientsError) {
                await loadAvailableIngredients();
              }
              setRequiredIngredientsDialogVisible(true);
            }}
            style={styles.selectButton}
          >
            {requiredIngredients.length > 0
              ? `${requiredIngredients.length} selected`
              : 'Select required ingredients'}
          </Button>
          {requiredIngredients.length > 0 && (
            <View style={styles.selectedChips}>
              {requiredIngredients.slice(0, 3).map((ing) => (
                <Chip key={ing} style={styles.selectedChip} onClose={() => toggleIngredient(ing, requiredIngredients, setRequiredIngredients)}>
                  {ing}
                </Chip>
              ))}
              {requiredIngredients.length > 3 && (
                <Chip style={styles.selectedChip}>+{requiredIngredients.length - 3} more</Chip>
              )}
            </View>
          )}

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Excluded Ingredients
          </Text>
          <Button
            mode="outlined"
            onPress={async () => {
              setExcludedSearchQuery('');
              // Reload ingredients if empty or if there was an error
              if (availableIngredients.length === 0 || ingredientsError) {
                await loadAvailableIngredients();
              }
              setExcludedIngredientsDialogVisible(true);
            }}
            style={styles.selectButton}
          >
            {excludedIngredients.length > 0
              ? `${excludedIngredients.length} selected`
              : 'Select excluded ingredients'}
          </Button>
          {excludedIngredients.length > 0 && (
            <View style={styles.selectedChips}>
              {excludedIngredients.slice(0, 3).map((ing) => (
                <Chip key={ing} style={styles.selectedChip} onClose={() => toggleIngredient(ing, excludedIngredients, setExcludedIngredients)}>
                  {ing}
                </Chip>
              ))}
              {excludedIngredients.length > 3 && (
                <Chip style={styles.selectedChip}>+{excludedIngredients.length - 3} more</Chip>
              )}
            </View>
          )}

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
            {recipe.cuisine && (
              <Text variant="bodySmall" style={styles.cuisine}>
                🌍 {recipe.cuisine} Cuisine
              </Text>
            )}
            {recipe.difficulty && (
              <Text variant="bodySmall" style={styles.difficulty}>
                {recipe.difficulty === 'easy' ? '🟢' : recipe.difficulty === 'medium' ? '🟡' : '🔴'} {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
              </Text>
            )}
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

      {/* Required Ingredients Dialog */}
      <Portal>
        <Dialog
          visible={requiredIngredientsDialogVisible}
          onDismiss={() => setRequiredIngredientsDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Select Required Ingredients</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <ScrollView
              style={styles.dialogScrollView}
              contentContainerStyle={styles.dialogScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Searchbar
                placeholder="Search ingredients..."
                onChangeText={setRequiredSearchQuery}
                value={requiredSearchQuery}
                style={styles.searchbar}
              />
              {loadingIngredients ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#0284c7" />
                  <Text variant="bodyMedium" style={styles.loadingText}>
                    Loading ingredients...
                  </Text>
                </View>
              ) : ingredientsError ? (
                <View style={styles.errorContainer}>
                  <Text variant="bodyMedium" style={styles.errorText}>
                    {ingredientsError}
                  </Text>
                  <Button
                    mode="outlined"
                    onPress={loadAvailableIngredients}
                    style={styles.retryButton}
                  >
                    Retry
                  </Button>
                </View>
              ) : filteredRequiredIngredients.length > 0 ? (
                <>
                  {console.log('Rendering ingredients list:', filteredRequiredIngredients)}
                  {filteredRequiredIngredients.map((ing) => {
                    console.log('Rendering ingredient:', ing);
                    return (
                      <View key={ing} style={styles.checkboxRow}>
                        <Checkbox
                          status={requiredIngredients.includes(ing) ? 'checked' : 'unchecked'}
                          onPress={() => toggleIngredient(ing, requiredIngredients, setRequiredIngredients)}
                        />
                        <Text
                          variant="bodyMedium"
                          onPress={() => toggleIngredient(ing, requiredIngredients, setRequiredIngredients)}
                          style={styles.checkboxText}
                        >
                          {ing}
                        </Text>
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text variant="bodyMedium" style={styles.noResults}>
                  {requiredSearchQuery
                    ? `No ingredients match "${requiredSearchQuery}". Available: ${availableIngredients.join(', ')}`
                    : `No ingredients available. Count: ${availableIngredients.length}. Add items to your pantry first!`}
                </Text>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRequiredIngredientsDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Excluded Ingredients Dialog */}
      <Portal>
        <Dialog
          visible={excludedIngredientsDialogVisible}
          onDismiss={() => setExcludedIngredientsDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Select Excluded Ingredients</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <ScrollView
              style={styles.dialogScrollView}
              contentContainerStyle={styles.dialogScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Searchbar
                placeholder="Search ingredients..."
                onChangeText={setExcludedSearchQuery}
                value={excludedSearchQuery}
                style={styles.searchbar}
              />
              {loadingIngredients ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#0284c7" />
                  <Text variant="bodyMedium" style={styles.loadingText}>
                    Loading ingredients...
                  </Text>
                </View>
              ) : ingredientsError ? (
                <View style={styles.errorContainer}>
                  <Text variant="bodyMedium" style={styles.errorText}>
                    {ingredientsError}
                  </Text>
                  <Button
                    mode="outlined"
                    onPress={loadAvailableIngredients}
                    style={styles.retryButton}
                  >
                    Retry
                  </Button>
                </View>
              ) : filteredExcludedIngredients.length > 0 ? (
                <>
                  {console.log('Rendering excluded ingredients list:', filteredExcludedIngredients)}
                  {filteredExcludedIngredients.map((ing) => {
                    console.log('Rendering excluded ingredient:', ing);
                    return (
                      <View key={ing} style={styles.checkboxRow}>
                        <Checkbox
                          status={excludedIngredients.includes(ing) ? 'checked' : 'unchecked'}
                          onPress={() => toggleIngredient(ing, excludedIngredients, setExcludedIngredients)}
                        />
                        <Text
                          variant="bodyMedium"
                          onPress={() => toggleIngredient(ing, excludedIngredients, setExcludedIngredients)}
                          style={styles.checkboxText}
                        >
                          {ing}
                        </Text>
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text variant="bodyMedium" style={styles.noResults}>
                  {excludedSearchQuery
                    ? `No ingredients match "${excludedSearchQuery}". Available: ${availableIngredients.join(', ')}`
                    : `No ingredients available. Count: ${availableIngredients.length}. Add items to your pantry first!`}
                </Text>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setExcludedIngredientsDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </ScrollView>
    </SafeAreaView>
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
  selectButton: {
    marginBottom: 12,
  },
  divider: {
    marginVertical: 12,
  },
  cuisine: {
    marginTop: 4,
    color: '#6b7280',
  },
  difficulty: {
    marginTop: 4,
    color: '#6b7280',
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 12,
  },
  selectedChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  dialog: {
    maxHeight: '80%',
  },
  dialogContent: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  dialogScrollView: {
    maxHeight: 400,
  },
  dialogScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  searchbar: {
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkboxText: {
    marginLeft: 8,
    flex: 1,
  },
  noResults: {
    textAlign: 'center',
    color: '#6b7280',
    padding: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#6b7280',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
});

