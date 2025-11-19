import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, Button, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';
import type { SavedRecipe } from '../types';

export default function RecipeBoxScreen() {
  const navigation = useNavigation();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSavedRecipes();
      setRecipes(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

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
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete recipe');
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
      <Text variant="titleLarge" style={styles.title}>
        Recipe Box
      </Text>

      {recipes.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No saved recipes yet. Generate and save recipes from the Recipes tab!
            </Text>
          </Card.Content>
        </Card>
      ) : (
        recipes.map((recipe) => {
          const ingredients = parseJson(recipe.ingredients);
          const instructions = parseJson(recipe.instructions);

          return (
            <Card
              key={recipe.id}
              style={styles.card}
            >
              <Card.Content>
                <Text variant="titleLarge">{recipe.name}</Text>
                {recipe.description && (
                  <Text variant="bodyMedium" style={styles.description}>
                    {recipe.description}
                  </Text>
                )}
                <View style={styles.meta}>
                  <Text variant="bodySmall">⏱️ {recipe.prep_time || 0} min prep</Text>
                  <Text variant="bodySmall">🔥 {recipe.cook_time || 0} min cook</Text>
                  <Text variant="bodySmall">👥 {recipe.servings || 4} servings</Text>
                </View>
                {recipe.cuisine && (
                  <Text variant="bodySmall" style={styles.cuisine}>
                    🌍 {recipe.cuisine}
                  </Text>
                )}
                <View style={styles.buttonRow}>
                  <Button
                    mode="contained"
                    onPress={() => navigation.navigate('RecipeDetail', { recipe } as never)}
                    style={[styles.viewButton, { marginRight: 8 }]}
                  >
                    View
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => handleDelete(recipe.id)}
                    style={styles.deleteButton}
                    textColor="#ef4444"
                  >
                    Delete
                  </Button>
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
    backgroundColor: '#f9fafb',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  description: {
    marginTop: 8,
    color: '#6b7280',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    marginBottom: 8,
  },
  cuisine: {
    color: '#6b7280',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  viewButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
  },
});

