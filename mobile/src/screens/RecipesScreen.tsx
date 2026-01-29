import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View, Alert, AppState, AppStateStatus, TouchableOpacity, TextInput as RNTextInput, Animated, Easing } from 'react-native';

// Instacart branding - using approved green color
const INSTACART_GREEN = '#43B02A';
import {
  Text,
  Button,
  Checkbox,
  Switch,
  ActivityIndicator,
  Menu,
  Portal,
  Dialog,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import { instacartService } from '../services/instacartService';
import { PantrySelector } from '../components/PantrySelector';
import { SkeletonRecipeCard, Skeleton } from '../components/Skeleton';
import { PremiumButton } from '../components/PremiumButton';
import { ScreenContentWrapper } from '../components/ScreenContentWrapper';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import type { Recipe, RecentRecipe } from '../types';

/** Minimal breathing dot for indeterminate wait — Dieter Rams: as little design as possible. */
function BreathingDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[styles.breathingDot, { backgroundColor: color, opacity }]} />;
}

/** Parse user preference text for count override and ingredient hints (e.g. "give me 2 recipes with cauliflower" → count 2, ingredients ["cauliflower"]). */
function parseUserPreference(preference: string): { countOverride?: number; ingredientsFromPreference: string[] } {
  const trimmed = preference.trim();
  if (!trimmed) return { ingredientsFromPreference: [] };

  let countOverride: number | undefined;
  const countMatch =
    trimmed.match(/\b(\d+)\s*recipes?\b/i) ??
    trimmed.match(/\brecipes?\s*(\d+)\b/i) ??
    trimmed.match(/\b(?:give me|I want|want)\s+(\d+)\b/i) ??
    trimmed.match(/\b(\d+)\s+(?:recipes?|with)\b/i);
  if (countMatch) {
    const n = parseInt(countMatch[1], 10);
    if (n >= 1 && n <= 20) countOverride = n;
  }

  const rawIngredients: string[] = [];
  const phraseRe = /(?:with|that have|containing|using)\s+([^.,]+?)(?=\s+recipes?|\s*$|\.|,|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(trimmed)) !== null) {
    const after = m[1].trim();
    const parts = after.split(/\s+and\s+|\s*,\s*/).map((p) => p.trim().toLowerCase()).filter((p) => p.length >= 2 && p !== 'recipes');
    rawIngredients.push(...parts);
  }
  const seen = new Set<string>();
  const ingredientsFromPreference = rawIngredients.filter((ing) => {
    const key = ing.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { countOverride, ingredientsFromPreference };
}

export default function RecipesScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const layout = useLayout();
  const { isAuthenticated } = useAuth();
  const ds = getDesignSystem(isDark);
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [generating, setGenerating] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [generationCount, setGenerationCount] = useState(5); // effective count for "x of y" during generation
  const [numRecipes, setNumRecipes] = useState(5);
  const [numRecipesText, setNumRecipesText] = useState('5');
  const [requiredIngredients, setRequiredIngredients] = useState<string[]>([]);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [allowMissing, setAllowMissing] = useState(false);
  const [cuisine, setCuisine] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [mealType, setMealType] = useState<string[]>([]);
  const [recipeType, setRecipeType] = useState<string[]>([]);
  const [cookingMethod, setCookingMethod] = useState<string[]>([]);
  const [userPreference, setUserPreference] = useState('');
  const [cuisineMenuVisible, setCuisineMenuVisible] = useState(false);
  const [difficultyMenuVisible, setDifficultyMenuVisible] = useState(false);
  const [requiredIngredientsDialogVisible, setRequiredIngredientsDialogVisible] = useState(false);
  const [excludedIngredientsDialogVisible, setExcludedIngredientsDialogVisible] = useState(false);
  const [selectedPantryId, setSelectedPantryId] = useState<number | undefined>();
  const [recentRecipes, setRecentRecipes] = useState<RecentRecipe[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  
  // Use ref for cancel flag so it's immediately accessible in the generation loop
  const cancelRequestedRef = useRef(false);

  // Load available ingredients from API
  const loadAvailableIngredients = useCallback(async () => {
    if (selectedPantryId === undefined) return;
    
    setLoadingIngredients(true);
    setIngredientsError(null);
    try {
      console.log('Loading ingredients from API...');
      const items = await apiClient.getInventory(0, 1000, undefined, undefined, selectedPantryId);
      console.log(`Loaded ${items.length} inventory items`);
      // Filter out expired and consumed items, but keep in_stock and low items
      const usableItems = items.filter(item => item.status !== 'expired' && item.status !== 'consumed');
      console.log(`${usableItems.length} usable items after filtering`);
      const uniqueNames = new Set<string>();
      usableItems.forEach((item) => {
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

  // Load recent recipes
  const loadRecentRecipes = useCallback(async () => {
    // Only load if user is authenticated
    if (!isAuthenticated) {
      setRecentRecipes([]);
      setLoadingRecent(false);
      return;
    }

    setLoadingRecent(true);
    try {
      const recent = await apiClient.getRecentRecipes(20);
      setRecentRecipes(recent);
      if (__DEV__) {
        console.log(`[RecipesScreen] Loaded ${recent.length} recent recipes`);
      }
    } catch (err: any) {
      // Log detailed error for debugging
      console.error('[RecipesScreen] Error loading recent recipes:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        url: err.config?.url,
        authenticated: isAuthenticated,
      });
      // Don't show error to user - recent recipes are optional
      // But ensure we don't keep stale data
      setRecentRecipes([]);
    } finally {
      setLoadingRecent(false);
    }
  }, [isAuthenticated]);

  // Load ingredients when pantry changes
  useEffect(() => {
    if (selectedPantryId !== undefined) {
      loadAvailableIngredients();
    }
  }, [selectedPantryId, loadAvailableIngredients]);

  // Reload ingredients when screen comes into focus (e.g., after adding items in Inventory)
  useFocusEffect(
    useCallback(() => {
      if (selectedPantryId !== undefined) {
        loadAvailableIngredients();
      }
    }, [selectedPantryId, loadAvailableIngredients])
  );

  // Load recent recipes on mount
  useEffect(() => {
    loadRecentRecipes();
  }, [loadRecentRecipes]);

  // Reload recent recipes when authentication state changes (e.g., after login)
  useEffect(() => {
    if (isAuthenticated) {
      loadRecentRecipes();
    } else {
      // Clear recipes when logged out
      setRecentRecipes([]);
    }
  }, [isAuthenticated, loadRecentRecipes]);

  // Reload recent recipes when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated) {
        // App has come to the foreground, reload recent recipes
        loadRecentRecipes();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, loadRecentRecipes]);

  const handleGenerateRecipes = async () => {
    try {
      setGenerating(true);
      setCancelRequested(false);
      cancelRequestedRef.current = false;
      setRecipes([]);

      const { countOverride, ingredientsFromPreference } = parseUserPreference(userPreference);
      const effectiveNumRecipes = countOverride ?? numRecipes;
      setGenerationCount(effectiveNumRecipes);
      const effectiveRequired = [...requiredIngredients];
      for (const ing of ingredientsFromPreference) {
        if (!effectiveRequired.some((r) => r.toLowerCase() === ing)) {
          effectiveRequired.push(ing);
        }
      }

      const newRecipes: Recipe[] = [];
      const avoidNames: string[] = [];

      for (let i = 0; i < effectiveNumRecipes; i++) {
        // Check if cancel was requested using ref
        if (cancelRequestedRef.current) {
          console.log('Recipe generation cancelled by user');
          break;
        }

        const recipe = await apiClient.generateSingleRecipe({
          required_ingredients: effectiveRequired.length > 0 ? effectiveRequired : undefined,
          excluded_ingredients: excludedIngredients.length > 0 ? excludedIngredients : undefined,
          cuisine: cuisine || undefined,
          difficulty: difficulty ? difficulty.toLowerCase() : undefined,
          dietary_restrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
          meal_type: mealType.length > 0 ? mealType : undefined,
          recipe_type: recipeType.length > 0 ? recipeType : undefined,
          cooking_method: cookingMethod.length > 0 ? cookingMethod : undefined,
          user_preference: userPreference.trim() || undefined,
          avoid_names: avoidNames,
          allow_missing_ingredients: allowMissing,
          pantry_id: selectedPantryId,
        });

        newRecipes.push(recipe);
        if (recipe.name) avoidNames.push(recipe.name);
        setRecipes([...newRecipes]);
      }

      // Reload recent recipes after generation completes
      // The backend automatically saves generated recipes to recent recipes
      await loadRecentRecipes();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate recipes');
      // Still try to reload recent recipes in case some were saved before the error
      await loadRecentRecipes();
    } finally {
      setGenerating(false);
      setCancelRequested(false);
      cancelRequestedRef.current = false;
    }
  };

  const handleCancelGeneration = () => {
    setCancelRequested(true);
    cancelRequestedRef.current = true;
  };

  const handleSaveRecipe = async (recipe: Recipe) => {
    const name = recipe.name;
    const isRecent = 'id' in recipe && typeof (recipe as RecentRecipe).id === 'number';

    // Optimistic: remove from list immediately so it disappears (moves to Recipe Box)
    removeRecipeFromList(name);

    try {
      if (isRecent) {
        await apiClient.saveRecentRecipe((recipe as RecentRecipe).id);
      } else {
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
          ai_model: recipe.ai_model, // Track which AI model generated this recipe
          flavor_pairings: recipe.flavor_pairings as any, // Flavor chemistry data
        });
      }
      Alert.alert('Success', `Saved "${name}" to recipe box!`);
      loadRecentRecipes();
    } catch (err: any) {
      const statusCode = err.response?.status;
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save recipe';
      // 409 = already saved: recipe is in Recipe Box. Don't refetch — backend still has it in
      // recent list, so loadRecentRecipes() would bring it back. We already removed it from UI.
      if (statusCode === 409 || errorMessage.includes('already saved')) {
        return;
      }
      Alert.alert('Error', errorMessage);
      // Re-add so user can retry
      if (isRecent) {
        setRecentRecipes((prev) => [...prev, recipe as RecentRecipe]);
      } else {
        setRecipes((prev) => [...prev, recipe]);
      }
    }
  };

  const removeRecipeFromList = (recipeName: string) => {
    setRecipes((prev) => prev.filter((r) => r.name !== recipeName));
    setRecentRecipes((prev) => prev.filter((r) => r.name !== recipeName));
  };

  const handleDeleteRecentRecipe = async (recipeId: number) => {
    try {
      await apiClient.deleteRecentRecipe(recipeId);
      setRecentRecipes(recentRecipes.filter((r) => r.id !== recipeId));
      Alert.alert('Success', 'Recent recipe deleted');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || err.message || 'Failed to delete recipe');
    }
  };

  const handleClearAllRecentRecipes = () => {
    if (recentRecipes.length === 0) return;
    
    Alert.alert(
      'Clear All Recent Recipes',
      `Are you sure you want to delete all ${recentRecipes.length} recent recipe(s)? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteAllRecentRecipes();
              setRecentRecipes([]);
              Alert.alert('Success', 'All recent recipes deleted');
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail || err.message || 'Failed to delete recipes');
            }
          },
        },
      ]
    );
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
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
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

  // Only show loading if we don't have ingredients yet
  if (loadingIngredients && availableIngredients.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
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
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="titleLarge" style={styles.title}>
            Recipe Suggestions
          </Text>
          <PantrySelector
            selectedPantryId={selectedPantryId}
            onPantryChange={setSelectedPantryId}
          />
          <View style={styles.center}>
            <Text variant="bodyLarge" style={{ color: isDark ? '#f87171' : '#dc2626', marginBottom: 16 }}>
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
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.scrollWrapper}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          layout.isTablet && { paddingHorizontal: layout.horizontalPadding, alignItems: 'center' },
          generating && { paddingTop: 148 },
        ]}
      >
      <ScreenContentWrapper>
      <View style={styles.header}>
        <Text testID="recipes-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
          Recipes
        </Text>
      </View>

      <PantrySelector
        selectedPantryId={selectedPantryId}
        onPantryChange={setSelectedPantryId}
      />

      {/* Recipe Generation Form - Minimal */}
      <View style={styles.formSection}>
        <View style={[styles.formDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />
        <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
          GENERATION OPTIONS
        </Text>

          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>
                NUMBER OF RECIPES
              </Text>
              <RNTextInput
                testID="num-recipes-input"
                value={numRecipesText}
                onChangeText={(text) => {
                  setNumRecipesText(text);
                  if (text === '' || text === null || text === undefined) {
                    return;
                  }
                  const num = parseInt(text, 10);
                  if (!isNaN(num) && num > 0) {
                    setNumRecipes(num);
                  }
                }}
                onBlur={() => {
                  if (numRecipesText === '' || isNaN(parseInt(numRecipesText, 10)) || parseInt(numRecipesText, 10) <= 0) {
                    setNumRecipesText(numRecipes.toString());
                  }
                }}
                keyboardType="numeric"
                style={[styles.textInput, { color: ds.colors.textPrimary, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)' }]}
                placeholder="5"
                placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => setAllowMissing(!allowMissing)}
            activeOpacity={0.6}
            accessibilityLabel="Allow missing ingredients"
            accessibilityHint={allowMissing ? 'Double tap to require all ingredients' : 'Double tap to allow recipes with missing ingredients'}
            accessibilityRole="switch"
          >
            <Text testID="allow-missing-label" style={[styles.switchLabel, { color: ds.colors.textPrimary }]}>
              Allow Missing Ingredients
            </Text>
            <Switch
              testID="allow-missing-checkbox"
              value={allowMissing}
              onValueChange={setAllowMissing}
              thumbColor={allowMissing ? ds.colors.textPrimary : '#f4f3f4'}
              trackColor={{ false: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)', true: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
              ios_backgroundColor={isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}
            />
          </TouchableOpacity>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>
              WHAT ARE YOU IN THE MOOD FOR?
            </Text>
            <RNTextInput
              testID="user-preference-input"
              value={userPreference}
              onChangeText={setUserPreference}
              style={[styles.textInput, { color: ds.colors.textPrimary, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)' }]}
              placeholder="e.g. recipes with cauliflower, quick weeknight dinner"
              placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
              underlineColorAndroid="transparent"
              accessibilityLabel="What are you in the mood for"
              accessibilityHint="Optional. Describe what you want, e.g. recipes with cauliflower"
            />
          </View>

          <View style={styles.formField}>
            <Menu
              visible={cuisineMenuVisible}
              onDismiss={() => setCuisineMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  testID="cuisine-selector"
                  onPress={() => setCuisineMenuVisible(true)}
                  style={[styles.selectField, { borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)' }]}
                  activeOpacity={0.6}
                  accessibilityLabel={`Cuisine: ${cuisine || 'Any'}`}
                  accessibilityHint="Double tap to choose cuisine"
                  accessibilityRole="button"
                >
                  <Text style={[styles.selectFieldText, { color: cuisine ? ds.colors.textPrimary : ds.colors.textSecondary }]}>
                    {cuisine || 'Any Cuisine'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={ds.colors.textTertiary} style={{ opacity: 0.4 }} />
                </TouchableOpacity>
              }
              contentStyle={{ backgroundColor: ds.colors.surface, borderRadius: 12 }}
            >
            <Menu.Item onPress={() => { setCuisine(''); setCuisineMenuVisible(false); }} title="Any" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Italian'); setCuisineMenuVisible(false); }} title="Italian" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Mexican'); setCuisineMenuVisible(false); }} title="Mexican" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Asian'); setCuisineMenuVisible(false); }} title="Asian" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('American'); setCuisineMenuVisible(false); }} title="American" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Mediterranean'); setCuisineMenuVisible(false); }} title="Mediterranean" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Indian'); setCuisineMenuVisible(false); }} title="Indian" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('French'); setCuisineMenuVisible(false); }} title="French" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Thai'); setCuisineMenuVisible(false); }} title="Thai" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Japanese'); setCuisineMenuVisible(false); }} title="Japanese" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setCuisine('Chinese'); setCuisineMenuVisible(false); }} title="Chinese" titleStyle={{ fontSize: 15 }} />
          </Menu>
          </View>

          <View style={styles.formField}>
            <Menu
              visible={difficultyMenuVisible}
              onDismiss={() => setDifficultyMenuVisible(false)}
              anchor={
                <TouchableOpacity
                  testID="difficulty-selector"
                  onPress={() => setDifficultyMenuVisible(true)}
                  style={[styles.selectField, { borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)' }]}
                  activeOpacity={0.6}
                  accessibilityLabel={`Difficulty: ${difficulty || 'Any'}`}
                  accessibilityHint="Double tap to choose difficulty"
                  accessibilityRole="button"
                >
                  <Text style={[styles.selectFieldText, { color: difficulty ? ds.colors.textPrimary : ds.colors.textSecondary }]}>
                    {difficulty || 'Any Difficulty'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={ds.colors.textTertiary} style={{ opacity: 0.4 }} />
                </TouchableOpacity>
              }
              contentStyle={{ backgroundColor: ds.colors.surface, borderRadius: 12 }}
            >
            <Menu.Item onPress={() => { setDifficulty(''); setDifficultyMenuVisible(false); }} title="Any" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setDifficulty('Easy'); setDifficultyMenuVisible(false); }} title="Easy" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setDifficulty('Medium'); setDifficultyMenuVisible(false); }} title="Medium" titleStyle={{ fontSize: 15 }} />
            <Menu.Item onPress={() => { setDifficulty('Hard'); setDifficultyMenuVisible(false); }} title="Hard" titleStyle={{ fontSize: 15 }} />
          </Menu>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>
              DIETARY RESTRICTIONS
            </Text>
            <View style={styles.optionPills}>
              {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto', 'Paleo'].map((diet) => (
                <TouchableOpacity
                  key={diet}
                  testID={`dietary-restriction-${diet.toLowerCase().replace('-', '')}`}
                  onPress={() => {
                    if (dietaryRestrictions.includes(diet)) {
                      setDietaryRestrictions(dietaryRestrictions.filter((d) => d !== diet));
                    } else {
                      setDietaryRestrictions([...dietaryRestrictions, diet]);
                    }
                  }}
                  accessibilityLabel={dietaryRestrictions.includes(diet) ? `${diet}, selected` : diet}
                  accessibilityHint={dietaryRestrictions.includes(diet) ? 'Double tap to deselect' : 'Double tap to select'}
                  accessibilityRole="button"
                  style={[
                    styles.optionPill,
                    { 
                      borderColor: dietaryRestrictions.includes(diet) 
                        ? ds.colors.textPrimary 
                        : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                    }
                  ]}
                >
                  <Text style={[
                    styles.optionPillText,
                    { color: dietaryRestrictions.includes(diet) ? ds.colors.textPrimary : ds.colors.textSecondary },
                    dietaryRestrictions.includes(diet) && { fontWeight: '500' }
                  ]}>
                    {diet}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>
              MEAL TYPE
            </Text>
            <View style={styles.optionPills}>
              {[
                { label: 'Breakfast', value: 'breakfast' },
                { label: 'Lunch', value: 'lunch' },
                { label: 'Dinner', value: 'dinner' },
                { label: 'Snack', value: 'snack' },
              ].map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    if (mealType.includes(value)) {
                      setMealType(mealType.filter((v) => v !== value));
                    } else {
                      setMealType([...mealType, value]);
                    }
                  }}
                  accessibilityLabel={mealType.includes(value) ? `${label}, selected` : label}
                  accessibilityHint={mealType.includes(value) ? 'Double tap to deselect' : 'Double tap to select'}
                  accessibilityRole="button"
                  style={[
                    styles.optionPill,
                    {
                      borderColor: mealType.includes(value)
                        ? ds.colors.textPrimary
                        : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      { color: mealType.includes(value) ? ds.colors.textPrimary : ds.colors.textSecondary },
                      mealType.includes(value) && { fontWeight: '500' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>
              RECIPE TYPE
            </Text>
            <View style={styles.optionPills}>
              {[
                { label: 'Entree', value: 'entree' },
                { label: 'Side Dish', value: 'side-dish' },
                { label: 'Snack', value: 'snack' },
                { label: 'Beverage', value: 'beverage' },
              ].map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    if (recipeType.includes(value)) {
                      setRecipeType(recipeType.filter((v) => v !== value));
                    } else {
                      setRecipeType([...recipeType, value]);
                    }
                  }}
                  accessibilityLabel={recipeType.includes(value) ? `${label}, selected` : label}
                  accessibilityHint={recipeType.includes(value) ? 'Double tap to deselect' : 'Double tap to select'}
                  accessibilityRole="button"
                  style={[
                    styles.optionPill,
                    {
                      borderColor: recipeType.includes(value)
                        ? ds.colors.textPrimary
                        : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      { color: recipeType.includes(value) ? ds.colors.textPrimary : ds.colors.textSecondary },
                      recipeType.includes(value) && { fontWeight: '500' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>
              COOKING METHOD
            </Text>
            <View style={styles.optionPills}>
              {[
                { label: 'Grilled', value: 'grilled' },
                { label: 'Baked', value: 'baked' },
                { label: 'One-pot', value: 'one-pot' },
                { label: 'Quick', value: 'quick' },
              ].map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    if (cookingMethod.includes(value)) {
                      setCookingMethod(cookingMethod.filter((v) => v !== value));
                    } else {
                      setCookingMethod([...cookingMethod, value]);
                    }
                  }}
                  accessibilityLabel={cookingMethod.includes(value) ? `${label}, selected` : label}
                  accessibilityHint={cookingMethod.includes(value) ? 'Double tap to deselect' : 'Double tap to select'}
                  accessibilityRole="button"
                  style={[
                    styles.optionPill,
                    {
                      borderColor: cookingMethod.includes(value)
                        ? ds.colors.textPrimary
                        : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      { color: cookingMethod.includes(value) ? ds.colors.textPrimary : ds.colors.textSecondary },
                      cookingMethod.includes(value) && { fontWeight: '500' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.formDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />

          <TouchableOpacity
            testID="required-ingredients-button"
            onPress={async () => {
              setRequiredSearchQuery('');
              if (availableIngredients.length === 0 || ingredientsError) {
                await loadAvailableIngredients();
              }
              setRequiredIngredientsDialogVisible(true);
            }}
            style={[styles.selectRow, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}
            activeOpacity={0.6}
            accessibilityLabel={`Required ingredients: ${requiredIngredients.length > 0 ? `${requiredIngredients.length} selected` : 'None'}`}
            accessibilityHint="Double tap to choose required ingredients"
            accessibilityRole="button"
          >
            <View style={styles.selectContent}>
              <Text style={[styles.selectLabel, { color: ds.colors.textTertiary }]}>
                REQUIRED INGREDIENTS
              </Text>
              <Text style={[styles.selectValue, { color: ds.colors.textPrimary }]}>
                {requiredIngredients.length > 0
                  ? `${requiredIngredients.length} selected`
                  : 'None'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={ds.colors.textTertiary} style={{ opacity: 0.4 }} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="excluded-ingredients-button"
            onPress={async () => {
              setExcludedSearchQuery('');
              if (availableIngredients.length === 0 || ingredientsError) {
                await loadAvailableIngredients();
              }
              setExcludedIngredientsDialogVisible(true);
            }}
            style={[styles.selectRow, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}
            activeOpacity={0.6}
            accessibilityLabel={`Excluded ingredients: ${excludedIngredients.length > 0 ? `${excludedIngredients.length} selected` : 'None'}`}
            accessibilityHint="Double tap to choose excluded ingredients"
            accessibilityRole="button"
          >
            <View style={styles.selectContent}>
              <Text style={[styles.selectLabel, { color: ds.colors.textTertiary }]}>
                EXCLUDED INGREDIENTS
              </Text>
              <Text style={[styles.selectValue, { color: ds.colors.textPrimary }]}>
                {excludedIngredients.length > 0
                  ? `${excludedIngredients.length} selected`
                  : 'None'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={ds.colors.textTertiary} style={{ opacity: 0.4 }} />
          </TouchableOpacity>

          <View style={[styles.formDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />

          <PremiumButton
            testID="generate-recipes-button"
            mode="contained"
            onPress={handleGenerateRecipes}
            disabled={generating}
            style={[styles.generateButton, { elevation: 0 }]}
          >
            {generating ? 'Generating...' : 'Generate Recipes'}
          </PremiumButton>

      </View>

      {/* Recent Recipes Section */}
      {(loadingRecent || recentRecipes.length > 0) && (
        <View style={styles.recipeSection}>
          <View style={[styles.formDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
              RECENT RECIPES
            </Text>
            {!loadingRecent && recentRecipes.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAllRecentRecipes}
                accessibilityLabel="Clear all recent recipes"
                accessibilityHint="Double tap to clear recent recipes list"
                accessibilityRole="button"
              >
                <Text style={[styles.clearAllText, { color: isDark ? '#f87171' : '#ef4444' }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {!loadingRecent && recentRecipes.length > 0 && (
            <Text style={[styles.sectionSubtext, { color: ds.colors.textSecondary }]}>
              Save to Recipe Box to keep forever
            </Text>
          )}
          {loadingRecent ? (
            <>
              <SkeletonRecipeCard />
              <SkeletonRecipeCard />
            </>
          ) : (
            recentRecipes.map((recentRecipe) => (
              <View
                key={recentRecipe.id}
                style={[styles.recipeItem, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}
              >
                <TouchableOpacity
                  onPress={() => navigation.navigate('RecipeDetail', { recipe: recentRecipe } as never)}
                  style={styles.recipeContent}
                  activeOpacity={0.6}
                  accessibilityLabel={recentRecipe.name}
                  accessibilityHint="Double tap to open recipe"
                  accessibilityRole="button"
                >
                  <Text style={[styles.recipeName, { color: ds.colors.textPrimary }]}>
                    {recentRecipe.name}
                  </Text>
                  {recentRecipe.description && (
                    <Text style={[styles.recipeDescription, { color: ds.colors.textSecondary }]} numberOfLines={2}>
                      {recentRecipe.description}
                    </Text>
                  )}
                  <View style={styles.recipeMeta}>
                    {recentRecipe.prep_time != null && (
                      <Text style={[styles.recipeMetaText, { color: ds.colors.textSecondary }]}>
                        {recentRecipe.prep_time} prep
                      </Text>
                    )}
                    {recentRecipe.cook_time != null && (
                      <Text style={[styles.recipeMetaText, { color: ds.colors.textSecondary }]}>
                        · {recentRecipe.cook_time} cook
                      </Text>
                    )}
                    {recentRecipe.servings != null && (
                      <Text style={[styles.recipeMetaText, { color: ds.colors.textSecondary }]}>
                        · {recentRecipe.servings} servings
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.recipeActions}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleSaveRecipe(recentRecipe as any);
                    }}
                    style={styles.recipeActionButton}
                    accessibilityLabel={`Save ${recentRecipe.name} to Recipe Box`}
                    accessibilityHint="Double tap to save recipe"
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons 
                      name="bookmark-outline" 
                      size={20} 
                      color={ds.colors.textPrimary} 
                      style={{ opacity: 0.6 }}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteRecentRecipe(recentRecipe.id);
                    }}
                    style={styles.recipeActionButton}
                    accessibilityLabel={`Delete ${recentRecipe.name} from recent`}
                    accessibilityHint="Double tap to remove from recent"
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons 
                      name="trash-can-outline" 
                      size={20} 
                      color={isDark ? '#f87171' : '#ef4444'} 
                      style={{ opacity: 0.6 }}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Generated Recipes Section — show when generating (skeleton slots) or when we have results */}
      {(generating || recipes.length > 0) && (
        <View style={styles.recipeSection}>
          <View style={[styles.formDivider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            GENERATED RECIPES
          </Text>
        </View>
      )}

      {recipes.map((recipe, idx) => (
        <View
          key={idx}
          style={[styles.recipeItem, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate('RecipeDetail', { recipe } as never)}
            style={styles.recipeContent}
            activeOpacity={0.6}
            accessibilityLabel={recipe.name}
            accessibilityHint="Double tap to open recipe"
            accessibilityRole="button"
          >
            <Text style={[styles.recipeName, { color: ds.colors.textPrimary }]}>
              {recipe.name}
            </Text>
            {recipe.description && (
              <Text style={[styles.recipeDescription, { color: ds.colors.textSecondary }]} numberOfLines={2}>
                {recipe.description}
              </Text>
            )}
            <View style={styles.recipeMeta}>
              {recipe.prep_time != null && (
                <Text style={[styles.recipeMetaText, { color: ds.colors.textSecondary }]}>
                  {recipe.prep_time} prep
                </Text>
              )}
              {recipe.cook_time != null && (
                <Text style={[styles.recipeMetaText, { color: ds.colors.textSecondary }]}>
                  · {recipe.cook_time} cook
                </Text>
              )}
              {recipe.servings != null && (
                <Text style={[styles.recipeMetaText, { color: ds.colors.textSecondary }]}>
                  · {recipe.servings} servings
                </Text>
              )}
            </View>
            {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
              <Text style={[styles.missingText, { color: ds.colors.warning }]}>
                Missing: {recipe.missing_ingredients.slice(0, 2).join(', ')}{recipe.missing_ingredients.length > 2 ? '...' : ''}
              </Text>
            )}
          </TouchableOpacity>
          <View style={styles.recipeActions}>
            {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  instacartService.shopMissingIngredients(recipe);
                }}
                style={styles.recipeActionButton}
                accessibilityLabel="Shop missing ingredients on Instacart"
                accessibilityHint="Double tap to open Instacart"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons 
                  name="cart-outline" 
                  size={22} 
                  color={INSTACART_GREEN} 
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleSaveRecipe(recipe);
              }}
              style={styles.recipeActionButton}
              accessibilityLabel={`Save ${recipe.name} to Recipe Box`}
              accessibilityHint="Double tap to save recipe"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons 
                name="bookmark-outline" 
                size={20} 
                color={ds.colors.textPrimary} 
                style={{ opacity: 0.6 }}
              />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Required Ingredients Dialog */}
      <Portal>
        <Dialog
          visible={requiredIngredientsDialogVisible}
          onDismiss={() => setRequiredIngredientsDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: ds.colors.textPrimary }]}>
            Required Ingredients
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <ScrollView
              style={styles.dialogScrollView}
              contentContainerStyle={styles.dialogScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <View style={[styles.dialogSearchContainer, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={ds.colors.textPrimary} style={{ opacity: 0.5 }} />
                <RNTextInput
                  placeholder="Search..."
                  onChangeText={setRequiredSearchQuery}
                  value={requiredSearchQuery}
                  style={[styles.dialogSearchInput, { color: ds.colors.textPrimary, backgroundColor: 'transparent' }]}
                  placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                  underlineColorAndroid="transparent"
                />
              </View>
              {loadingIngredients ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={ds.colors.primary} />
                  <Text variant="bodyMedium" style={[styles.loadingText, { color: ds.colors.textSecondary }]}>
                    Loading ingredients...
                  </Text>
                </View>
              ) : ingredientsError ? (
                <View style={styles.errorContainer}>
                  <Text variant="bodyMedium" style={[styles.errorText, { color: isDark ? '#f87171' : '#dc2626' }]}>
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
                <Text variant="bodyMedium" style={[styles.noResults, { color: ds.colors.textSecondary }]}>
                  {requiredSearchQuery
                    ? `No ingredients match "${requiredSearchQuery}". Available: ${availableIngredients.join(', ')}`
                    : `No ingredients available. Count: ${availableIngredients.length}. Add items to your pantry first!`}
                </Text>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRequiredIngredientsDialogVisible(false)} labelStyle={styles.dialogButtonLabel} uppercase={false}>
              Done
            </Button>
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
          <Dialog.Title style={[styles.dialogTitle, { color: ds.colors.textPrimary }]}>
            Excluded Ingredients
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <ScrollView
              style={styles.dialogScrollView}
              contentContainerStyle={styles.dialogScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <View style={[styles.dialogSearchContainer, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={ds.colors.textPrimary} style={{ opacity: 0.5 }} />
                <RNTextInput
                  placeholder="Search..."
                  onChangeText={setExcludedSearchQuery}
                  value={excludedSearchQuery}
                  style={[styles.dialogSearchInput, { color: ds.colors.textPrimary, backgroundColor: 'transparent' }]}
                  placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
                  underlineColorAndroid="transparent"
                />
              </View>
              {loadingIngredients ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={ds.colors.primary} />
                  <Text variant="bodyMedium" style={[styles.loadingText, { color: ds.colors.textSecondary }]}>
                    Loading ingredients...
                  </Text>
                </View>
              ) : ingredientsError ? (
                <View style={styles.errorContainer}>
                  <Text variant="bodyMedium" style={[styles.errorText, { color: isDark ? '#f87171' : '#dc2626' }]}>
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
                <Text variant="bodyMedium" style={[styles.noResults, { color: ds.colors.textSecondary }]}>
                  {excludedSearchQuery
                    ? `No ingredients match "${excludedSearchQuery}". Available: ${availableIngredients.join(', ')}`
                    : `No ingredients available. Count: ${availableIngredients.length}. Add items to your pantry first!`}
                </Text>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setExcludedIngredientsDialogVisible(false)} labelStyle={styles.dialogButtonLabel} uppercase={false}>
              Done
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </ScreenContentWrapper>
      </ScrollView>

      {/* Fixed "live slot" card — always visible, shows current recipe index + shimmer (dynamic, no scroll needed) */}
      {generating && (
        <View style={[styles.liveSlotCard, { backgroundColor: ds.colors.surface, borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]}>
          <View style={styles.liveSlotHeader}>
            <Text style={[styles.liveSlotTitle, { color: ds.colors.textPrimary }]}>
              Recipe {recipes.length + 1} of {generationCount}
            </Text>
            <TouchableOpacity
              onPress={handleCancelGeneration}
              style={styles.cancelButton}
              disabled={cancelRequested}
              accessibilityLabel={cancelRequested ? 'Cancelling' : 'Cancel generation'}
              accessibilityHint="Double tap to cancel recipe generation"
              accessibilityRole="button"
            >
              <Text style={[styles.cancelText, { color: cancelRequested ? ds.colors.textTertiary : ds.colors.textPrimary }]}>
                {cancelRequested ? 'Cancelling…' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.liveSlotShimmer}>
            <View style={styles.liveSlotShimmerRow}>
              <BreathingDot color={ds.colors.textSecondary} />
              <Skeleton width="72%" height={14} borderRadius={6} style={{ marginLeft: 10 }} />
            </View>
            <Skeleton width="90%" height={12} borderRadius={6} style={{ marginTop: 10 }} />
            <Skeleton width="55%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        </View>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollWrapper: {
    flex: 1,
  },
  liveSlotCard: {
    position: 'absolute',
    top: 12,
    left: 24,
    right: 24,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    zIndex: 10,
  },
  liveSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveSlotTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  liveSlotShimmer: {
    flexDirection: 'column',
  },
  liveSlotShimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  // Form Section - Minimal
  formSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  formDivider: {
    height: 1,
    marginVertical: 24,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 16,
    opacity: 0.55,
  },
  formRow: {
    marginBottom: 20,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.55,
  },
  textInput: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.2,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.2,
    flex: 1,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectFieldText: {
    fontSize: 15,
    letterSpacing: -0.1,
  },
  optionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionPillText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  selectContent: {
    flex: 1,
  },
  selectLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.55,
  },
  selectValue: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  formRow: {
    marginBottom: 20,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.55,
  },
  textInput: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.2,
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.2,
    flex: 1,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectFieldText: {
    fontSize: 15,
    letterSpacing: -0.1,
  },
  optionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionPillText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  selectContent: {
    flex: 1,
  },
  selectLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.55,
  },
  selectValue: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  generateButton: {
    marginTop: 24,
    elevation: 0,
  },
  breathingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  // Recipe Sections
  recipeSection: {
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  sectionSubtext: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.6,
    letterSpacing: -0.1,
  },
  // Recipe Items - Clean list
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  recipeContent: {
    flex: 1,
  },
  recipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  recipeActionButton: {
    padding: 8,
  },
  recipeName: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  recipeDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  recipeMetaText: {
    fontSize: 14,
    opacity: 0.6,
    letterSpacing: -0.1,
  },
  missingText: {
    fontSize: 13,
    marginTop: 6,
    opacity: 0.9,
  },
  // Dialogs
  dialog: {
    borderRadius: 20,
  },
  dialogContent: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  dialogScrollView: {
    maxHeight: 400,
  },
  dialogScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  searchbar: {
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkboxText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 15,
  },
  noResults: {
    textAlign: 'center',
    padding: 24,
    fontSize: 15,
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 15,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 15,
  },
  retryButton: {
    marginTop: 8,
    elevation: 0,
  },
  dialogTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  dialogSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  dialogSearchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
    padding: 0,
    letterSpacing: -0.1,
    backgroundColor: 'transparent',
  },
  dialogButtonLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});

