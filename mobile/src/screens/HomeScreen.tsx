import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const quickActions = [
    { 
      title: 'View Inventory', 
      icon: 'package-variant', 
      screen: 'Inventory',
      color: '#3b82f6'
    },
    { 
      title: 'Generate Recipes', 
      icon: 'chef-hat', 
      screen: 'Recipes',
      color: '#10b981'
    },
    { 
      title: 'View Statistics', 
      icon: 'chart-bar', 
      screen: 'Statistics',
      color: '#8b5cf6'
    },
        {
          title: 'Recipe Box',
          icon: 'book-open-variant',
          screen: 'RecipeBox',
          color: '#ec4899'
        },
        {
          title: 'Settings',
          icon: 'cog',
          screen: 'Settings',
          color: '#6b7280'
        },
      ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
      <Text variant="headlineLarge" style={styles.title}>
        Smart Pantry
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Manage your pantry inventory with AI-powered OCR and recipe generation
      </Text>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Quick Actions
      </Text>

      {quickActions.map((action, index) => (
        <Card
          key={index}
          style={styles.card}
        >
          <Card.Content style={styles.cardContent}>
            <Button
              icon={action.icon}
              mode="contained"
              buttonColor={action.color}
              style={styles.actionButton}
              onPress={() => navigation.navigate(action.screen as never)}
            >
              {action.title}
            </Button>
          </Card.Content>
        </Card>
      ))}

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Features
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodyMedium">📸 Image Processing</Text>
          <Text variant="bodySmall" style={styles.featureText}>
            Upload images of pantry items and automatically extract product information
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodyMedium">🤖 AI-Powered Analysis</Text>
          <Text variant="bodySmall" style={styles.featureText}>
            Intelligent product recognition and categorization
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodyMedium">🍳 Recipe Generation</Text>
          <Text variant="bodySmall" style={styles.featureText}>
            Generate recipes based on available ingredients with flavor chemistry insights
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodyMedium">📊 Analytics</Text>
          <Text variant="bodySmall" style={styles.featureText}>
            Track inventory, expiration dates, and consumption patterns
          </Text>
        </Card.Content>
      </Card>

      {user && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.userInfo}>
              {user.full_name || user.email}
            </Text>
            <Button
              mode="outlined"
              onPress={handleLogout}
              textColor="#dc2626"
              style={styles.logoutButton}
            >
              Sign Out
            </Button>
          </Card.Content>
        </Card>
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
    color: '#0284c7',
  },
  subtitle: {
    marginBottom: 24,
    color: '#6b7280',
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
    color: '#111827',
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardContent: {
    paddingVertical: 8,
  },
  actionButton: {
    marginVertical: 4,
  },
  featureText: {
    marginTop: 4,
    color: '#6b7280',
  },
  userInfo: {
    marginBottom: 8,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 8,
    borderColor: '#dc2626',
  },
});

