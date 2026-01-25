import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { DesignSystem, getDesignSystem } from '../utils/designSystem';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import InventoryScreen from '../screens/InventoryScreen';
import RecipesScreen from '../screens/RecipesScreen';
import RecipeBoxScreen from '../screens/RecipeBoxScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ds.colors.primary,
        tabBarInactiveTintColor: ds.colors.textTertiary,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: ds.colors.surface,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 12,
          height: 85,
          paddingBottom: 24,
          paddingTop: 12,
          marginBottom: 8,
          borderRadius: ds.borderRadius.lg,
          marginHorizontal: 12,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity {...props} testID="tab-home" accessibilityLabel="Home" />
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="package-variant" size={size} color={color} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity {...props} testID="tab-inventory" accessibilityLabel="Inventory" />
          ),
        }}
      />
      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="chef-hat" size={size} color={color} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity {...props} testID="tab-recipes" accessibilityLabel="Recipes" />
          ),
        }}
      />
      <Tab.Screen
        name="RecipeBox"
        component={RecipeBoxScreen}
        options={{
          tabBarLabel: 'Recipe Box',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="book-open-variant" size={size} color={color} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity {...props} testID="tab-recipe-box" accessibilityLabel="Recipe Box" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: ds.colors.background }}>
        <ActivityIndicator size="large" color={ds.colors.primary} />
      </View>
    );
  }

  // Use DefaultTheme or DarkTheme as base, then override colors
  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: ds.colors.primary,
          background: ds.colors.background,
          card: ds.colors.surface,
          text: ds.colors.textPrimary,
          border: ds.colors.surfaceHover,
          notification: ds.colors.error,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: ds.colors.primary,
          background: ds.colors.background,
          card: ds.colors.surface,
          text: ds.colors.textPrimary,
          border: ds.colors.surfaceHover,
          notification: ds.colors.error,
        },
      };

  return (
    <View style={{ flex: 1, backgroundColor: ds.colors.background }}>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            // Auth screens
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            // Main app screens
            <>
              <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Statistics"
                component={StatisticsScreen}
                options={{ title: 'Statistics', headerShown: true }}
              />
              <Stack.Screen
                name="RecipeDetail"
                component={RecipeDetailScreen}
                options={{ title: 'Recipe Details', headerShown: true }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings', headerShown: true }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

