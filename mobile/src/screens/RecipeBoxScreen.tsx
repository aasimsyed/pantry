import React, { useState, useCallback, useRef, useMemo } from 'react';
import { ScrollView, StyleSheet, View, Alert, RefreshControl, TouchableOpacity, FlatList, TextInput as RNTextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem, getTextStyle } from '../utils/designSystem';
import { ScreenContentWrapper } from '../components/ScreenContentWrapper';
import apiClient, { getApiErrorMessage } from '../api/client';
import StarRating from '../components/StarRating';
import { SkeletonRecipeCard } from '../components/Skeleton';
import { PremiumButton } from '../components/PremiumButton';
import type { SavedRecipe, FlavorPairing } from '../types';

export default function RecipeBoxScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCuisine, setFilterCuisine] = useState<string | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);
  const [filterDietary, setFilterDietary] = useState<string[]>([]);
  const [filterMealType, setFilterMealType] = useState<string[]>([]);
  const [filterCookingMethod, setFilterCookingMethod] = useState<string[]>([]);
  const [filterRecipeType, setFilterRecipeType] = useState<string[]>([]);
  const [filterMinRating, setFilterMinRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [semanticSearchQuery, setSemanticSearchQuery] = useState<string | null>(null);
  const [semanticResults, setSemanticResults] = useState<{ recipe: SavedRecipe; score: number }[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const filterRef = useRef({ cuisine: null as string | null, difficulty: null as string | null, tags: [] as string[] });
  filterRef.current = {
    cuisine: filterCuisine,
    difficulty: filterDifficulty,
    tags: [...filterDietary, ...filterMealType, ...filterCookingMethod, ...filterRecipeType],
  };

  const filteredRecipes = useMemo(() => {
    let list = recipes;
    if (filterMinRating != null) {
      list = list.filter((r) => (r.rating ?? 0) >= filterMinRating);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.cuisine && r.cuisine.toLowerCase().includes(q))
    );
  }, [recipes, searchQuery, filterMinRating]);

  const displayList = useMemo(() => {
    if (semanticSearchQuery != null) return semanticResults.map((r) => r.recipe);
    return filteredRecipes;
  }, [semanticSearchQuery, semanticResults, filteredRecipes]);

  const loadRecipes = useCallback(async (showLoading = true) => {
    try {
      if (showLoading && !hasLoadedRef.current) {
        setLoading(true);
      }
      const { cuisine, difficulty, tags } = filterRef.current;
      const data = await apiClient.getSavedRecipes(
        cuisine || undefined,
        difficulty || undefined,
        tags.length > 0 ? tags : undefined
      );
      if (__DEV__) {
        console.log('RecipeBoxScreen - loaded recipes:', data.length);
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
    setSemanticSearchQuery(null);
    loadRecipes(false);
  }, [loadRecipes]);

  const runSemanticSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSemanticSearchQuery(null);
      return;
    }
    setSemanticSearchQuery(q);
    setSemanticLoading(true);
    try {
      const data = await apiClient.searchSavedRecipesSemantic(q, 20);
      setSemanticResults(data);
    } catch (err: unknown) {
      Alert.alert('Search error', getApiErrorMessage(err));
      setSemanticResults([]);
    } finally {
      setSemanticLoading(false);
    }
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSemanticSearchQuery(null);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSemanticSearchQuery(null);
  }, []);

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

  const keyExtractor = useCallback((item: SavedRecipe) => item.id.toString(), []);

  const renderItem = useCallback(
    ({ item: recipe, index }: { item: SavedRecipe; index: number }) => {
      const isLast = index === displayList.length - 1;
      return (
        <TouchableOpacity
          testID={`recipe-box-card-${recipe.id}`}
          style={[
            styles.recipeItem,
            { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' },
            isLast && { borderBottomWidth: 0 },
          ]}
          onPress={() => navigation.navigate('RecipeDetail', { recipe } as never)}
        >
          <View style={styles.recipeContent}>
            <Text style={[styles.recipeName, { color: ds.colors.textPrimary }]}>{recipe.name}</Text>
            {recipe.description && (
              <Text style={[styles.recipeDescription, { color: ds.colors.textSecondary }]} numberOfLines={2}>
                {recipe.description}
              </Text>
            )}
            <View style={styles.recipeMeta}>
              {recipe.cuisine && (
                <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}>{recipe.cuisine}</Text>
              )}
              {recipe.cuisine && recipe.difficulty && (
                <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}> · </Text>
              )}
              {recipe.difficulty && (
                <Text style={[styles.metaText, { color: ds.colors.textTertiary }]}>{recipe.difficulty}</Text>
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
    },
    [displayList.length, isDark, ds.colors, navigation]
  );

  const FILTER_CUISINES = useMemo(() => [
    { label: 'All', value: null },
    { label: 'Indian', value: 'indian' }, { label: 'Italian', value: 'italian' }, { label: 'Mexican', value: 'mexican' },
    { label: 'Asian', value: 'asian' }, { label: 'American', value: 'american' }, { label: 'Mediterranean', value: 'mediterranean' },
    { label: 'French', value: 'french' }, { label: 'Thai', value: 'thai' }, { label: 'Japanese', value: 'japanese' }, { label: 'Chinese', value: 'chinese' },
  ], []);
  const FILTER_DIFFICULTIES = useMemo(() => [
    { label: 'All', value: null },
    { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' },
  ], []);
  const FILTER_DIETARY = useMemo(() => [
    { label: 'Vegan', value: 'vegan' }, { label: 'Vegetarian', value: 'vegetarian' },
    { label: 'Gluten-free', value: 'gluten-free' }, { label: 'Dairy-free', value: 'dairy-free' },
  ], []);
  const FILTER_MEAL_TYPE = useMemo(() => [
    { label: 'Breakfast', value: 'breakfast' }, { label: 'Lunch', value: 'lunch' },
    { label: 'Dinner', value: 'dinner' }, { label: 'Snack', value: 'snack' },
  ], []);
  const FILTER_COOKING_METHOD = useMemo(() => [
    { label: 'Grilled', value: 'grilled' }, { label: 'Baked', value: 'baked' },
    { label: 'One-pot', value: 'one-pot' }, { label: 'Quick', value: 'quick' },
  ], []);
  const FILTER_RECIPE_TYPE = useMemo(() => [
    { label: 'Entree', value: 'entree' }, { label: 'Side Dish', value: 'side-dish' },
    { label: 'Snack', value: 'snack' }, { label: 'Beverage', value: 'beverage' },
  ], []);
  const FILTER_STAR_RATING = useMemo(() => [
    { label: 'All', value: null },
    { label: '1+ stars', value: 1 }, { label: '2+ stars', value: 2 }, { label: '3+ stars', value: 3 },
    { label: '4+ stars', value: 4 }, { label: '5 stars', value: 5 },
  ], []);

  const applyFilter = useCallback(() => {
    setFilterVisible(false);
    loadRecipes(false);
  }, [loadRecipes]);

  const clearFilter = useCallback(() => {
    setFilterCuisine(null);
    setFilterDifficulty(null);
    setFilterDietary([]);
    setFilterMealType([]);
    setFilterCookingMethod([]);
    setFilterRecipeType([]);
    setFilterMinRating(null);
  }, []);

  const listHeaderComponent = useMemo(
    () => (
      <>
        <View style={[styles.header, styles.headerRow]}>
          <Text testID="recipe-box-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
            Recipe Box
          </Text>
          <TouchableOpacity
            testID="recipe-box-filter"
            onPress={() => setFilterVisible(true)}
            style={[styles.filterIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            accessibilityLabel="Open filters"
          >
            <MaterialCommunityIcons name="filter-variant" size={22} color={ds.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchContainer, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
          <MaterialCommunityIcons name="magnify" size={22} color={ds.colors.textPrimary} style={{ opacity: 0.5 }} />
          <RNTextInput
            testID="recipe-box-search"
            placeholder="Search recipes"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={runSemanticSearch}
            returnKeyType="search"
            style={[styles.searchInput, { color: ds.colors.textPrimary, backgroundColor: 'transparent' }]}
            placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
            autoCapitalize="none"
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close-circle" size={20} color={ds.colors.textPrimary} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          )}
        </View>
        {semanticSearchQuery != null && (
          <View style={[styles.semanticHint, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            {semanticLoading ? (
              <ActivityIndicator size="small" color={ds.colors.textPrimary} style={styles.semanticLoading} />
            ) : (
              <Text style={[styles.semanticHintText, { color: ds.colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                Like: "{semanticSearchQuery}"
              </Text>
            )}
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.semanticHintClear, { color: ds.colors.textPrimary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    ),
    [searchQuery, isDark, ds.colors.textPrimary, semanticSearchQuery, semanticLoading, runSemanticSearch, clearSearch]
  );

  const listEmptyComponent = useMemo(() => {
    if (semanticSearchQuery != null && !semanticLoading) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: ds.colors.textPrimary }]}>No recipes like that</Text>
          <Text style={[styles.emptyText, { color: ds.colors.textSecondary }]}>
            No similar recipes for "{semanticSearchQuery}". Try different words or clear to see all your recipes.
          </Text>
          <TouchableOpacity onPress={clearSearch} style={[styles.emptyButton, { backgroundColor: ds.colors.textPrimary }]}>
            <Text style={[styles.emptyButtonText, { color: ds.colors.background }]}>Clear search</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (searchQuery.trim() && semanticSearchQuery == null) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: ds.colors.textPrimary }]}>No matches</Text>
          <Text style={[styles.emptyText, { color: ds.colors.textSecondary }]}>
            No recipes match "{searchQuery.trim()}". Press Enter to find similar recipes.
          </Text>
          <TouchableOpacity onPress={clearSearch} style={[styles.emptyButton, { backgroundColor: ds.colors.textPrimary }]}>
            <Text style={[styles.emptyButtonText, { color: ds.colors.background }]}>Clear search</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: ds.colors.textPrimary }]}>No Recipes Yet</Text>
        <Text style={[styles.emptyText, { color: ds.colors.textSecondary }]}>
          Your saved recipes will appear here. Generate and save recipes from the Recipes tab!
        </Text>
        <TouchableOpacity
          testID="empty-recipe-box-button"
          onPress={() => navigation.navigate('Recipes' as never)}
          style={[styles.emptyButton, { backgroundColor: ds.colors.textPrimary }]}
        >
          <Text style={[styles.emptyButtonText, { color: ds.colors.background }]}>Go to Recipes</Text>
        </TouchableOpacity>
      </View>
    );
  }, [searchQuery, semanticSearchQuery, semanticLoading, ds.colors.textPrimary, ds.colors.textSecondary, ds.colors.background, navigation, clearSearch]);

  const filterSectionLabel = (label: string) => (
    <Text style={[styles.filterSectionLabel, { color: ds.colors.textTertiary }]}>{label}</Text>
  );

  const FilterOptionRow = useCallback(({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.filterOptionRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterOptionLabel, { color: ds.colors.textPrimary }]}>{label}</Text>
      <View style={[styles.filterOptionIndicator, selected && { backgroundColor: ds.colors.textPrimary, borderColor: ds.colors.textPrimary }]} />
    </TouchableOpacity>
  ), [isDark, ds.colors.textPrimary]);

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
      <ScreenContentWrapper style={styles.screenWrapper}>
        <FlatList
          data={displayList}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={[
            styles.listContent,
            layout.isTablet && { paddingHorizontal: layout.horizontalPadding },
          ]}
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      </ScreenContentWrapper>

      <Modal visible={filterVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.filterOverlay}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={[styles.filterSheet, { backgroundColor: ds.colors.background }]}>
            <View style={[styles.filterSheetHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.filterSheetTitle, { color: ds.colors.textPrimary }]}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <MaterialCommunityIcons name="close" size={24} color={ds.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false}>
              {filterSectionLabel('CUISINE')}
              {FILTER_CUISINES.map(({ label, value }) => (
                <FilterOptionRow
                  key={value ?? 'all'}
                  label={label}
                  selected={filterCuisine === value}
                  onPress={() => setFilterCuisine(value)}
                />
              ))}
              {filterSectionLabel('DIFFICULTY')}
              {FILTER_DIFFICULTIES.map(({ label, value }) => (
                <FilterOptionRow
                  key={value ?? 'all'}
                  label={label}
                  selected={filterDifficulty === value}
                  onPress={() => setFilterDifficulty(value)}
                />
              ))}
              {filterSectionLabel('DIETARY')}
              {FILTER_DIETARY.map(({ label, value }) => (
                <FilterOptionRow
                  key={value}
                  label={label}
                  selected={filterDietary.includes(value)}
                  onPress={() => setFilterDietary((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))}
                />
              ))}
              {filterSectionLabel('MEAL TYPE')}
              {FILTER_MEAL_TYPE.map(({ label, value }) => (
                <FilterOptionRow
                  key={value}
                  label={label}
                  selected={filterMealType.includes(value)}
                  onPress={() => setFilterMealType((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))}
                />
              ))}
              {filterSectionLabel('COOKING METHOD')}
              {FILTER_COOKING_METHOD.map(({ label, value }) => (
                <FilterOptionRow
                  key={value}
                  label={label}
                  selected={filterCookingMethod.includes(value)}
                  onPress={() => setFilterCookingMethod((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))}
                />
              ))}
              {filterSectionLabel('RECIPE TYPE')}
              {FILTER_RECIPE_TYPE.map(({ label, value }) => (
                <FilterOptionRow
                  key={value}
                  label={label}
                  selected={filterRecipeType.includes(value)}
                  onPress={() => setFilterRecipeType((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]))}
                />
              ))}
              {filterSectionLabel('STAR RATING')}
              {FILTER_STAR_RATING.map(({ label, value }) => (
                <FilterOptionRow
                  key={value ?? 'all'}
                  label={label}
                  selected={filterMinRating === value}
                  onPress={() => setFilterMinRating(value)}
                />
              ))}
            </ScrollView>
            <View style={[styles.filterSheetFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
              <TouchableOpacity onPress={clearFilter} style={styles.filterClearBtn}>
                <Text style={[styles.filterClearText, { color: ds.colors.textSecondary }]}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyFilter} style={[styles.filterApplyBtn, { backgroundColor: ds.colors.textPrimary }]}>
                <Text style={[styles.filterApplyText, { color: ds.colors.background }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenWrapper: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    marginLeft: 12,
    marginRight: 8,
    padding: 0,
    includeFontPadding: false,
  },
  semanticHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  semanticHintText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.8,
    marginRight: 12,
  },
  semanticHintClear: {
    fontSize: 15,
    fontWeight: '500',
  },
  semanticLoading: {
    marginRight: 12,
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
  // Filter modal (Rams / Ive: restraint, clarity, space)
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  filterSheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  filterScroll: {
    maxHeight: 400,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 8,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  filterOptionLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  filterOptionIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.4)',
  },
  filterSheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    gap: 16,
  },
  filterClearBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterClearText: {
    fontSize: 17,
    fontWeight: '500',
  },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

