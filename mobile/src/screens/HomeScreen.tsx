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

  const actions = [
    { 
      title: 'Inventory', 
      subtitle: 'View and manage items',
      icon: 'package-variant', 
      screen: 'Inventory',
    },
    { 
      title: 'Recipes', 
      subtitle: 'AI-powered suggestions',
      icon: 'chef-hat', 
      screen: 'Recipes',
    },
    { 
      title: 'Recipe Box', 
      subtitle: 'Your saved favorites',
      icon: 'book-open-variant',
      screen: 'RecipeBox',
    },
    { 
      title: 'Statistics', 
      subtitle: 'Insights and trends',
      icon: 'chart-bar', 
      screen: 'Statistics',
    },
    {
      title: 'Settings',
      subtitle: 'Preferences and account',
      icon: 'cog',
      screen: 'Settings',
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
        {/* Hero Section - Refined, minimal */}
        <View style={styles.heroSection}>
          <Text testID="home-title" style={[styles.heroTitle, { color: ds.colors.textPrimary }]}>
            Smart Pantry
          </Text>
          <Text testID="home-subtitle" style={[styles.heroSubtitle, { color: ds.colors.textSecondary }]}>
            Manage your food. Reduce waste.
          </Text>
        </View>

        {/* Actions - Clean list, Rams/Ive style */}
        <View style={styles.actionsSection}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              testID={`action-${action.screen.toLowerCase()}`}
              style={[
                styles.actionItem,
                { 
                  borderBottomColor: isDark 
                    ? 'rgba(255, 255, 255, 0.08)' 
                    : 'rgba(0, 0, 0, 0.08)',
                  borderBottomWidth: index < actions.length - 1 ? 1 : 0,
                }
              ]}
              onPress={() => navigation.navigate(action.screen as never)}
              activeOpacity={0.6}
            >
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons 
                  name={action.icon as any} 
                  size={22} 
                  color={ds.colors.textPrimary}
                  style={{ opacity: 0.8 }}
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: ds.colors.textPrimary }]}>
                  {action.title}
                </Text>
                <Text style={[styles.actionSubtitle, { color: ds.colors.textSecondary }]}>
                  {action.subtitle}
                </Text>
              </View>
              <MaterialCommunityIcons 
                name="chevron-right" 
                size={20} 
                color={ds.colors.textTertiary}
                style={{ opacity: 0.4 }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Technology Section - Informational, Minimal */}
        <View style={styles.technologySection}>
          <View 
            style={[
              styles.sectionDivider,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }
            ]} 
          />
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            CAPABILITIES
          </Text>
          
          {/* Technology Stack - Clean, minimal presentation */}
          <View style={styles.technologyList}>
            {[
              { title: 'Image Processing', desc: 'Automatic product extraction from photos' },
              { title: 'AI Analysis', desc: 'Intelligent recognition and categorization' },
              { title: 'Recipe Generation', desc: 'Flavor chemistry-based suggestions' },
              { title: 'Analytics', desc: 'Track inventory and consumption patterns' },
            ].map((feature, index) => (
              <View key={index} style={styles.technologyItem}>
                <Text style={[styles.technologyTitle, { color: ds.colors.textPrimary }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.technologyDesc, { color: ds.colors.textSecondary }]}>
                  {feature.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* User Section - Minimal */}
        {user && (
          <View style={styles.userSection}>
            <View 
              style={[
                styles.userDivider,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }
              ]} 
            />
            <View style={styles.userInfo}>
              <View style={styles.userDetails}>
                <Text style={[styles.userLabel, { color: ds.colors.textTertiary }]}>
                  Signed in as
                </Text>
                <Text style={[styles.userName, { color: ds.colors.textPrimary }]}>
                  {user.full_name || user.email}
                </Text>
              </View>
              <TouchableOpacity
                testID="logout-button"
                onPress={handleLogout}
                style={styles.logoutButton}
                activeOpacity={0.6}
              >
                <Text style={[styles.logoutText, { color: ds.colors.textSecondary }]}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingTop: 32,
    paddingBottom: 40,
  },
  // Hero Section - Rams/Ive: Clarity through typography
  heroSection: {
    paddingHorizontal: 24,
    marginBottom: 48,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.2,
    marginBottom: 8,
    lineHeight: 44,
  },
  heroSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    opacity: 0.6,
  },
  // Actions - Rams: "Weniger, aber besser" (Less, but better)
  actionsSection: {
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    // No background, no shadow - pure function
  },
  actionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    letterSpacing: -0.1,
    opacity: 0.6,
  },
  // Technology Section - Rams: Pure information, no decoration
  technologySection: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  sectionDivider: {
    height: 1,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 20,
    fontWeight: '600',
    opacity: 0.55,
  },
  technologyList: {
    gap: 20,
  },
  technologyItem: {
    // Pure typography - no containers, no decoration
  },
  technologyTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  technologyDesc: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
    letterSpacing: -0.1,
  },
  // User Section - Ive: Subtle, purposeful
  userSection: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  userDivider: {
    height: 1,
    marginBottom: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userDetails: {
    flex: 1,
  },
  userLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: '500',
    opacity: 0.65,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});

