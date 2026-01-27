import React, { useState, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem, getTextStyle } from '../utils/designSystem';
import apiClient, { getApiErrorMessage } from '../api/client';
import StarRating from '../components/StarRating';
import { SkeletonRecipeCard } from '../components/Skeleton';
import { PremiumButton } from '../components/PremiumButton';
import type { SavedRecipe, FlavorPairing } from '../types';

export default function RecipeBoxScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadRecipes = useCallback(async (showLoading = true) => {
    try {
      // Only show loading skeleton on first load, not on re-renders
      if (showLoading && !hasLoadedRef.current) {
        setLoading(true);
      }
      const data = await apiClient.getSavedRecipes();
      if (__DEV__) {
        console.log('RecipeBoxScreen - loaded recipes:', data.length);
        data.forEach((r, i) => {
          console.log(`Recipe ${i}: ${r.name}, flavor_pairings:`, r.flavor_pairings?.length || 0);
        });
      }
      setRecipes(data);
      hasLoadedRef.current = true;
    } catch (err: unknown) {
      Alert.alert('Error', getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRecipes(false);
  }, [loadRecipes]);

  // Load recipes only once on mount (use pull-to-refresh for updates)
  React.useEffect(() => {
    if (!hasLoadedRef.current) {
      loadRecipes(true);
    }
  }, [loadRecipes]);


  const handleDelete = async (recipeId: number) => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteSavedRecipe(recipeId);
              await loadRecipes();
            } catch (err: unknown) {
              Alert.alert('Error', getApiErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  const parseJson = (str: string | null | undefined): any[] => {
    if (!str) return [];
    try {
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch {
      return [];
    }
  };

  // Check if recipe has flavor pairings
  const hasFlavorPairings = (recipe: SavedRecipe): boolean => {
    if (!recipe.flavor_pairings) return false;
    const pairings = typeof recipe.flavor_pairings === 'string' 
      ? parseJson(recipe.flavor_pairings)
      : recipe.flavor_pairings;
    return Array.isArray(pairings) && pairings.length > 0;
  };

  // Only show skeleton on initial load when we have no data yet
  if (loading && recipes.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text testID="recipe-box-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
              Recipe Box
            </Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={ds.colors.textPrimary} />
            <Text style={[styles.loadingText, { color: ds.colors.textSecondary }]}>
              Loading recipes...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <View style={styles.header}>
        <Text testID="recipe-box-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
          Recipe Box
        </Text>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: ds.colors.textPrimary }]}>
            No Recipes Yet
          </Text>
          <Text style={[styles.emptyText, { color: ds.colors.textSecondary }]}>
            Your saved recipes will appear here. Generate and save recipes from the Recipes tab!
          </Text>
          <TouchableOpacity
            testID="empty-recipe-box-button"
            onPress={() => navigation.navigate('Recipes' as never)}
            style={[styles.emptyButton, { backgroundColor: ds.colors.textPrimary }]}
          >
            <Text style={[styles.emptyButtonText, { color: ds.colors.background }]}>
              Go to Recipes
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {recipes.map((recipe, index) => {
            const ingredients = parseJson(recipe.ingredients);
            const instructions = parseJson(recipe.instructions);
            const isLast = index === recipes.length - 1;

            return (
              <TouchableOpacity
                key={recipe.id}
                testID={`recipe-box-card-${recipe.id}`}
                style={[
                  styles.recipeItem,
                  { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' },
                  isLast && { borderBottomWidth: 0 },
                ]}
                onPress={() => navigation.navigate('RecipeDetail', { recipe } as never)}
              >
                <View style={styles.recipeContent}>
                  <Text style={[styles.recipeName, { color: ds.colors.textPrimary }]}>
                    {recipe.name}
                  </Text>
                  
                  {recipe.description && (
                    <Text style={[styles.recipeDescription, { color: ds.colors.textSecondary }]} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                  )}

                  <View style={styles.recipeMeta}>
                    {recipe.cuisine && (
                      <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}>
                        {recipe.cuisine}
                      </Text>
                    )}
                    {recipe.cuisine && recipe.difficulty && (
                      <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}> · </Text>
                    )}
                    {recipe.difficulty && (
                      <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}>
                        {recipe.difficulty}
                      </Text>
                    )}
                    {(recipe.cuisine || recipe.difficulty) && (recipe.prep_time || recipe.cook_time) && (
                      <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}> · </Text>
                    )}
                    {(recipe.prep_time || recipe.cook_time) && (
                      <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}>
                        {(recipe.prep_time || 0) + (recipe.cook_time || 0)} min
                      </Text>
                    )}
                  </View>

                  {recipe.rating != null && recipe.rating > 0 && (
                    <View style={styles.ratingContainer}>
                      <StarRating rating={recipe.rating} readonly size={14} />
                    </View>
                  )}
                </View>

                <View style={styles.recipeActions}>
                  <TouchableOpacity
                    testID={`recipe-box-delete-${recipe.id}`}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(recipe.id);
                    }}
                    style={styles.deleteButton}
                  >
                    <MaterialCommunityIcons 
                      name="trash-can-outline" 
                      size={20} 
                      color={isDark ? '#f87171' : '#ef4444'} 
                      style={{ opacity: 0.6 }}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
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
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: '700',
    fontSize: 34,
    letterSpacing: -0.5,
    lineHeight: 41,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  // Empty state
  emptyContainer: {
    paddingHorizontal: 24,
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // Recipe list items
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  recipeContent: {
    flex: 1,
    paddingRight: 16,
  },
  recipeName: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  recipeDescription: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.6,
    marginBottom: 8,
  },
  recipeMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    opacity: 0.65,
    letterSpacing: -0.1,
  },
  ratingContainer: {
    marginTop: 8,
  },
  recipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
  },
});

