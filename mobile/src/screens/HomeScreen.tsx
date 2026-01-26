import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Text, useTheme as usePaperTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { PremiumButton } from '../components/PremiumButton';
import { DesignSystem, getDesignSystem, getTextStyle } from '../utils/designSystem';

export default function HomeScreen() {
  const navigation = useNavigation();
  const paperTheme = usePaperTheme();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const quickActions = [
    { 
      title: 'View Inventory', 
      subtitle: 'Manage your pantry',
      icon: 'package-variant', 
      screen: 'Inventory',
      gradient: ['#3B82F6', '#2563EB'],
      iconBg: 'rgba(59, 130, 246, 0.1)',
    },
    { 
      title: 'Generate Recipes', 
      subtitle: 'AI-powered suggestions',
      icon: 'chef-hat', 
      screen: 'Recipes',
      gradient: ['#10B981', '#059669'],
      iconBg: 'rgba(16, 185, 129, 0.1)',
    },
    { 
      title: 'View Statistics', 
      subtitle: 'Insights & analytics',
      icon: 'chart-bar', 
      screen: 'Statistics',
      gradient: ['#8B5CF6', '#7C3AED'],
      iconBg: 'rgba(139, 92, 246, 0.1)',
    },
    {
      title: 'Recipe Box',
      subtitle: 'Your saved recipes',
      icon: 'book-open-variant',
      screen: 'RecipeBox',
      gradient: ['#EC4899', '#DB2777'],
      iconBg: 'rgba(236, 72, 153, 0.1)',
    },
    {
      title: 'Settings',
      subtitle: 'Preferences & account',
      icon: 'cog',
      screen: 'Settings',
      gradient: ['#6B7280', '#4B5563'],
      iconBg: 'rgba(107, 114, 128, 0.1)',
    },
  ];

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={ds.colors.background} />
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: ds.colors.background }}
        >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text testID="home-title" style={[styles.heroTitle, getTextStyle('display', ds.colors.primary, isDark)]}>Smart Pantry</Text>
          <Text testID="home-subtitle" style={[styles.heroSubtitle, getTextStyle('body', ds.colors.textSecondary, isDark)]}>
            Manage your pantry with AI-powered intelligence
          </Text>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              testID={`quick-action-${action.screen.toLowerCase()}`}
              style={[styles.actionCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}
              onPress={() => navigation.navigate(action.screen as never)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: action.iconBg }]}>
                <MaterialCommunityIcons 
                  name={action.icon as any} 
                  size={32} 
                  color={action.gradient[0]} 
                />
              </View>
              <Text style={[styles.actionTitle, getTextStyle('title', ds.colors.textPrimary, isDark)]}>{action.title}</Text>
              <Text style={[styles.actionSubtitle, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>{action.subtitle}</Text>
              <View style={[styles.actionGradient, { backgroundColor: ds.colors.primary }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, getTextStyle('headline', ds.colors.textPrimary, isDark)]}>Features</Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: '📸', title: 'Image Processing', desc: 'Automatic product extraction from photos' },
              { icon: '🤖', title: 'AI Analysis', desc: 'Intelligent recognition and categorization' },
              { icon: '🍳', title: 'Recipe Generation', desc: 'Flavor chemistry-based recipe suggestions' },
              { icon: '📊', title: 'Analytics', desc: 'Track inventory and consumption patterns' },
            ].map((feature, index) => (
              <Card key={index} style={[styles.featureCard, { backgroundColor: ds.colors.surface, ...ds.shadows.sm }]}>
                <Card.Content style={styles.featureContent}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <Text style={[styles.featureTitle, getTextStyle('label', ds.colors.textPrimary, isDark)]}>{feature.title}</Text>
                  <Text style={[styles.featureDesc, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>{feature.desc}</Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        </View>

        {/* User Section */}
        {user && (
          <Card style={[styles.userCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
            <Card.Content style={styles.userContent}>
              <View style={styles.userInfo}>
                <View style={[styles.userAvatar, { backgroundColor: ds.colors.surfaceHover }]}>
                  <MaterialCommunityIcons name="account" size={24} color={ds.colors.primary} />
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, getTextStyle('title', ds.colors.textPrimary, isDark)]}>{user.full_name || 'User'}</Text>
                  <Text style={[styles.userEmail, getTextStyle('caption', ds.colors.textSecondary, isDark)]}>{user.email}</Text>
                </View>
              </View>
              <Button
                testID="logout-button"
                mode="outlined"
                onPress={handleLogout}
                textColor={ds.colors.error}
                style={styles.logoutButton}
                labelStyle={{ fontSize: 16, fontWeight: '600' }}
                uppercase={false}
              >
                Sign Out
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: DesignSystem.spacing.md,
    paddingBottom: DesignSystem.spacing.xxl,
  },
  // Hero Section
  heroSection: {
    marginBottom: DesignSystem.spacing.xl,
    paddingTop: 24,
  },
  heroTitle: {
    marginBottom: 8,
  },
  heroSubtitle: {
    lineHeight: 24,
  },
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -DesignSystem.spacing.sm,
    marginBottom: DesignSystem.spacing.xl,
  },
  actionCard: {
    width: '48%',
    margin: '1%',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionTitle: {
    marginBottom: 4,
  },
  actionSubtitle: {
    marginBottom: 8,
  },
  actionGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.1,
  },
  // Features
  featuresSection: {
    marginBottom: DesignSystem.spacing.xl,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -DesignSystem.spacing.sm,
  },
  featureCard: {
    width: '48%',
    margin: '1%',
    marginBottom: 16,
    borderRadius: 16,
  },
  featureContent: {
    padding: DesignSystem.spacing.md,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: DesignSystem.spacing.sm,
  },
  featureTitle: {
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDesc: {
    textAlign: 'center',
    lineHeight: 18,
  },
  // User Card
  userCard: {
    borderRadius: 16,
    marginTop: 16,
  },
  userContent: {
    padding: DesignSystem.spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DesignSystem.spacing.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    marginBottom: 2,
  },
  userEmail: {
  },
  logoutButton: {
    borderRadius: 12,
  },
  logoutLabel: {
  },
});

