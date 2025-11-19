import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, Divider } from 'react-native-paper';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Recipe, SavedRecipe } from '../types';

type RouteParams = {
  RecipeDetail: {
    recipe: Recipe | SavedRecipe;
  };
};

export default function RecipeDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'RecipeDetail'>>();
  const { recipe } = route.params;

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
});

