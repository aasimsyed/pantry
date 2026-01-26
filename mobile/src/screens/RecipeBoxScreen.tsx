import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

  const loadRecipes = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiClient.getSavedRecipes();
      setRecipes(data);
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

  // Reload recipes when screen comes into focus (e.g., after saving a recipe)
  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [loadRecipes])
  );


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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
          <Text testID="recipe-box-title" variant="titleLarge" style={[styles.title, { color: ds.colors.textPrimary }]}>
            Recipe Box
          </Text>
          <SkeletonRecipeCard />
          <SkeletonRecipeCard />
          <SkeletonRecipeCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      <Text testID="recipe-box-title" variant="titleLarge" style={styles.title}>
        Recipe Box
      </Text>

      {recipes.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <Text variant="displaySmall" style={styles.emptyEmoji}>📚</Text>
            <Text variant="titleLarge" style={styles.emptyTitle}>
              No Recipes Yet
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Your saved recipes will appear here. Generate and save recipes from the Recipes tab!
            </Text>
            <PremiumButton
              testID="empty-recipe-box-button"
              mode="contained"
              onPress={() => navigation.navigate('Recipes' as never)}
              style={styles.emptyButton}
            >
              Go to Recipes
            </PremiumButton>
          </Card.Content>
        </Card>
      ) : (
        recipes.map((recipe) => {
          const ingredients = parseJson(recipe.ingredients);
          const instructions = parseJson(recipe.instructions);

          return (
            <Card
              key={recipe.id}
              testID={`recipe-box-card-${recipe.id}`}
              style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}
            >
              <Card.Content style={{ paddingVertical: 20, paddingHorizontal: 20 }}>
                <Text 
                  variant="titleLarge" 
                  style={[styles.recipeTitle, { color: ds.colors.textPrimary }]}
                >
                  {recipe.name}
                </Text>
                {recipe.description && (
                  <Text 
                    variant="bodyMedium" 
                    style={[styles.description, { color: ds.colors.textSecondary }]}
                  >
                    {recipe.description}
                  </Text>
                )}
                <View style={styles.metaDivider} />
                <View style={styles.meta}>
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaValue, { color: ds.colors.textPrimary }]}>
                      {recipe.prep_time || 0}
                    </Text>
                    <Text style={[styles.metaLabel, { color: ds.colors.textTertiary }]}>
                      PREP
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaValue, { color: ds.colors.textPrimary }]}>
                      {recipe.cook_time || 0}
                    </Text>
                    <Text style={[styles.metaLabel, { color: ds.colors.textTertiary }]}>
                      COOK
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaValue, { color: ds.colors.textPrimary }]}>
                      {recipe.servings || 4}
                    </Text>
                    <Text style={[styles.metaLabel, { color: ds.colors.textTertiary }]}>
                      SERVINGS
                    </Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  {recipe.cuisine && (
                    <Text variant="bodySmall" style={styles.cuisine}>
                      🌍 {recipe.cuisine}
                    </Text>
                  )}
                  {hasFlavorPairings(recipe) && (
                    <View style={[styles.flavorBadge, { backgroundColor: `${ds.colors.accent}15` }]}>
                      <MaterialCommunityIcons name="flask-outline" size={12} color={ds.colors.accent} />
                      <Text style={[styles.flavorBadgeText, { color: ds.colors.accent }]}>
                        Flavor Science
                      </Text>
                    </View>
                  )}
                </View>
                {recipe.ai_model && (
                  <Text variant="bodySmall" style={{ color: ds.colors.textTertiary, fontSize: 11, marginTop: 4 }}>
                    🤖 Generated by {recipe.ai_model}
                  </Text>
                )}
                {recipe.rating != null && recipe.rating > 0 && (
                  <View style={styles.ratingContainer}>
                    <StarRating rating={recipe.rating} readonly size={18} />
                  </View>
                )}
                {recipe.notes && (
                  <View style={styles.notesContainer}>
                    <Text variant="bodySmall" style={[styles.notesLabel, { color: ds.colors.textSecondary }]}>📝 Notes:</Text>
                    <Text variant="bodySmall" style={[styles.notesText, { color: ds.colors.textPrimary }]}>{recipe.notes}</Text>
                  </View>
                )}
                <View style={styles.buttonRow}>
                  <PremiumButton
                    testID={`recipe-box-view-${recipe.id}`}
                    mode="contained"
                    onPress={() => navigation.navigate('RecipeDetail', { recipe } as never)}
                    style={[styles.viewButton, { marginRight: 8 }]}
                  >
                    View
                  </PremiumButton>
                  <PremiumButton
                    testID={`recipe-box-delete-${recipe.id}`}
                    mode="outlined"
                    onPress={() => handleDelete(recipe.id)}
                    textColor={isDark ? '#f87171' : '#ef4444'}
                  >
                    Delete
                  </PremiumButton>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 20,
  },
  content: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  title: {
    fontWeight: '700',
    fontSize: 32,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
  },
  recipeTitle: {
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  description: {
    marginTop: 10,
    marginBottom: 0,
    lineHeight: 22,
    fontSize: 15,
    opacity: 0.85,
  },
  metaDivider: {
    height: 20,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: 16,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontWeight: '700',
    fontSize: 28,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  metaLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  cuisine: {
    marginTop: 6,
    opacity: 0.7,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  flavorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  flavorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  viewButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
  emptyCard: {
    marginTop: 60,
    marginHorizontal: 4,
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: 20,
    opacity: 0.9,
  },
  emptyTitle: {
    fontWeight: '700',
    fontSize: 24,
    letterSpacing: -0.3,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: 8,
    opacity: 0.7,
  },
  emptyButton: {
    marginTop: 8,
    borderRadius: 14,
    height: 48,
    minWidth: 160,
  },
  ratingContainer: {
    marginTop: 12,
    marginBottom: 6,
  },
  notesContainer: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(59, 130, 246, 0.4)',
  },
  notesLabel: {
    fontWeight: '600',
    marginBottom: 6,
    fontSize: 13,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  notesText: {
    lineHeight: 22,
    fontSize: 15,
  },
});

