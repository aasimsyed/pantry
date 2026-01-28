import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import { useLayout } from '../hooks/useLayout';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const layout = useLayout();
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

  const contentWrapperStyle = [
    styles.contentWrapper,
    layout.contentMaxWidth != null && { maxWidth: layout.contentMaxWidth },
    { paddingHorizontal: layout.horizontalPadding },
  ];

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={ds.colors.background} />
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
        <ScrollView 
          contentContainerStyle={[styles.content, layout.isTablet && styles.contentTablet]}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: ds.colors.background }}
        >
        <View style={contentWrapperStyle}>
        {/* Hero Section - Refined, minimal; slightly larger on tablet */}
        <View style={[styles.heroSection, layout.isTablet && styles.heroSectionTablet]}>
          <Text testID="home-title" style={[styles.heroTitle, layout.isTablet && styles.heroTitleTablet, { color: ds.colors.textPrimary }]}>
            Smart Pantry
          </Text>
          <Text testID="home-subtitle" style={[styles.heroSubtitle, layout.isTablet && styles.heroSubtitleTablet, { color: ds.colors.textSecondary }]}>
            Manage your food. Reduce waste.
          </Text>
        </View>

        {/* Actions - Single column on phone; 2-column grid on tablet (Rams/Ive: purposeful use of space) */}
        <View style={[styles.actionsSection, layout.isTablet && styles.actionsSectionTablet]}>
          <View style={layout.isTablet ? styles.actionsGrid : undefined}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                testID={`action-${action.screen.toLowerCase()}`}
                style={[
                  styles.actionItem,
                  layout.isTablet && styles.actionItemTablet,
                  { 
                    borderBottomColor: isDark 
                      ? 'rgba(255, 255, 255, 0.08)' 
                      : 'rgba(0, 0, 0, 0.08)',
                    borderBottomWidth: layout.isTablet 
                      ? (index < 4 ? 1 : 0) 
                      : (index < actions.length - 1 ? 1 : 0),
                    borderRightColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                    borderRightWidth: layout.isTablet && index % 2 === 0 ? 1 : 0,
                  }
                ]}
                onPress={() => navigation.navigate(action.screen as never)}
                activeOpacity={0.6}
              >
                <View style={[styles.actionIcon, layout.isTablet && styles.actionIconTablet]}>
                  <MaterialCommunityIcons 
                    name={action.icon as any} 
                    size={layout.isTablet ? 26 : 22} 
                    color={ds.colors.textPrimary}
                    style={{ opacity: 0.8 }}
                  />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionTitle, layout.isTablet && styles.actionTitleTablet, { color: ds.colors.textPrimary }]}>
                    {action.title}
                  </Text>
                  <Text style={[styles.actionSubtitle, layout.isTablet && styles.actionSubtitleTablet, { color: ds.colors.textSecondary }]}>
                    {action.subtitle}
                  </Text>
                </View>
                <MaterialCommunityIcons 
                  name="chevron-right" 
                  size={layout.isTablet ? 22 : 20} 
                  color={ds.colors.textTertiary}
                  style={{ opacity: 0.4 }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Technology Section - Informational, Minimal */}
        <View style={[styles.technologySection, layout.isTablet && styles.technologySectionTablet]}>
          <View 
            style={[
              styles.sectionDivider,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }
            ]} 
          />
          <Text style={[styles.sectionLabel, layout.isTablet && styles.sectionLabelTablet, { color: ds.colors.textTertiary }]}>
            CAPABILITIES
          </Text>
          
          {/* Technology Stack - Clean, minimal presentation; 2-col on tablet */}
          <View style={[styles.technologyList, layout.isTablet && styles.technologyListTablet]}>
            {[
              { title: 'Image Processing', desc: 'Automatic product extraction from photos' },
              { title: 'AI Analysis', desc: 'Intelligent recognition and categorization' },
              { title: 'Recipe Generation', desc: 'Flavor chemistry-based suggestions' },
              { title: 'Analytics', desc: 'Track inventory and consumption patterns' },
            ].map((feature, index) => (
              <View key={index} style={[styles.technologyItem, layout.isTablet && styles.technologyItemTablet]}>
                <Text style={[styles.technologyTitle, layout.isTablet && styles.technologyTitleTablet, { color: ds.colors.textPrimary }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.technologyDesc, layout.isTablet && styles.technologyDescTablet, { color: ds.colors.textSecondary }]}>
                  {feature.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* User Section - Minimal */}
        {user && (
          <View style={[styles.userSection, layout.isTablet && styles.userSectionTablet]}>
            <View 
              style={[
                styles.userDivider,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }
              ]} 
            />
            <View style={styles.userInfo}>
              <View style={styles.userDetails}>
                <Text style={[styles.userLabel, layout.isTablet && styles.userLabelTablet, { color: ds.colors.textTertiary }]}>
                  Signed in as
                </Text>
                <Text style={[styles.userName, layout.isTablet && styles.userNameTablet, { color: ds.colors.textPrimary }]}>
                  {user.full_name || user.email}
                </Text>
              </View>
              <TouchableOpacity
                testID="logout-button"
                onPress={handleLogout}
                style={styles.logoutButton}
                activeOpacity={0.6}
              >
                <Text style={[styles.logoutText, layout.isTablet && styles.logoutTextTablet, { color: ds.colors.textSecondary }]}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        </View>
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
  contentTablet: {
    paddingTop: 48,
    paddingBottom: 56,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  // Hero Section - Rams/Ive: Clarity through typography
  heroSection: {
    marginBottom: 48,
  },
  heroSectionTablet: {
    marginBottom: 56,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.2,
    marginBottom: 8,
    lineHeight: 44,
  },
  heroTitleTablet: {
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.5,
  },
  heroSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    opacity: 0.6,
  },
  heroSubtitleTablet: {
    fontSize: 19,
    lineHeight: 26,
  },
  // Actions - Rams: "Weniger, aber besser"; tablet: 2-col grid, purposeful use of space
  actionsSection: {
    marginBottom: 40,
  },
  actionsSectionTablet: {
    marginBottom: 48,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
  },
  actionItemTablet: {
    width: '50%',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  actionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionIconTablet: {
    width: 48,
    height: 48,
    marginRight: 20,
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
  actionTitleTablet: {
    fontSize: 18,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    letterSpacing: -0.1,
    opacity: 0.6,
  },
  actionSubtitleTablet: {
    fontSize: 15,
  },
  // Technology Section - Rams: Pure information; tablet: 2-col
  technologySection: {
    marginBottom: 40,
  },
  technologySectionTablet: {
    marginBottom: 48,
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
  sectionLabelTablet: {
    fontSize: 12,
    marginBottom: 24,
  },
  technologyList: {
    gap: 20,
  },
  technologyListTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  technologyItem: {},
  technologyItemTablet: {
    width: '48%',
  },
  technologyTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  technologyTitleTablet: {
    fontSize: 16,
    marginBottom: 6,
  },
  technologyDesc: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
    letterSpacing: -0.1,
  },
  technologyDescTablet: {
    fontSize: 15,
    lineHeight: 22,
  },
  // User Section - Ive: Subtle, purposeful
  userSection: {
    marginTop: 20,
  },
  userSectionTablet: {
    marginTop: 28,
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
  userLabelTablet: {
    fontSize: 13,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  userNameTablet: {
    fontSize: 16,
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
  logoutTextTablet: {
    fontSize: 16,
  },
});

