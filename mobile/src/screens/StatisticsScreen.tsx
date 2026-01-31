import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import apiClient from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import { ScreenContentWrapper } from '../components/ScreenContentWrapper';
import { Skeleton } from '../components/Skeleton';
import type { Statistics } from '../types';

// Health score ring component
const HealthScoreRing = ({ 
  score, 
  size = 140, 
  strokeWidth = 12,
  color,
  backgroundColor,
}: { 
  score: number; 
  size?: number; 
  strokeWidth?: number;
  color: string;
  backgroundColor: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (score / 100) * circumference;
  
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '700', color }}>{score}</Text>
        <Text style={{ fontSize: 12, color, opacity: 0.7, marginTop: -2 }}>/ 100</Text>
      </View>
    </View>
  );
};

// Progress bar component
const ProgressBar = ({ 
  value, 
  maxValue, 
  color, 
  backgroundColor,
  height = 8,
}: { 
  value: number; 
  maxValue: number; 
  color: string; 
  backgroundColor: string;
  height?: number;
}) => {
  const progress = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  
  return (
    <View style={{ height, backgroundColor, borderRadius: height / 2, overflow: 'hidden' }}>
      <View 
        style={{ 
          height: '100%', 
          width: `${progress * 100}%`, 
          backgroundColor: color,
          borderRadius: height / 2,
        }} 
      />
    </View>
  );
};

export default function StatisticsScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getStatistics();
      setStats(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return ds.colors.success;
    if (score >= 60) return '#F59E0B'; // amber
    if (score >= 40) return ds.colors.warning;
    return ds.colors.error;
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
        <View style={[styles.content, layout.isTablet && { paddingHorizontal: layout.horizontalPadding }]}>
          <Skeleton width="30%" height={36} borderRadius={8} style={{ marginBottom: 24 }} />
          <Skeleton width="100%" height={140} borderRadius={20} style={{ marginBottom: 24 }} />
          <Skeleton width="90%" height={24} borderRadius={6} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={80} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
        <View style={styles.center} accessibilityRole="none" accessibilityLabel="No insights yet. Add items to your pantry to see health score, storage breakdown, and usage stats." accessibilityHint="Empty state">
          <Text style={[styles.emptyTitle, { color: ds.colors.textPrimary }]}>No insights yet</Text>
          <Text style={[styles.emptyText, { color: ds.colors.textSecondary }]}>
            Add items to your pantry to see health score, storage breakdown, and usage stats.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const healthColor = getHealthColor(stats.health_score);
  const totalStorage = Object.values(stats.storage_counts || {}).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          layout.isTablet && { paddingHorizontal: layout.horizontalPadding, alignItems: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContentWrapper>
        {/* Header */}
        <Text style={[styles.title, { color: ds.colors.textPrimary }]}>
          Insights
        </Text>

        {/* Pantry Health Score */}
        <View style={[styles.healthCard, { backgroundColor: ds.colors.surface }]} accessibilityRole="none" accessibilityLabel={`Pantry health score ${stats.health_score} out of 100, ${getHealthLabel(stats.health_score)}`} accessibilityHint="Summary of pantry health">
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            PANTRY HEALTH
          </Text>
          <View style={styles.healthContent}>
            <HealthScoreRing 
              score={stats.health_score} 
              color={healthColor}
              backgroundColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
            />
            <View style={styles.healthDetails}>
              <Text style={[styles.healthLabel, { color: healthColor }]}>
                {getHealthLabel(stats.health_score)}
              </Text>
              <View style={styles.healthFactors}>
                {Object.entries(stats.health_factors || {}).map(([factor, score]) => (
                  <View key={factor} style={styles.factorRow}>
                    <Text style={[styles.factorLabel, { color: ds.colors.textSecondary }]}>
                      {factor === 'tracking' ? 'Expiration Tracking' :
                       factor === 'freshness' ? 'Freshness' :
                       factor === 'low_waste' ? 'Low Waste' :
                       factor === 'diversity' ? 'Category Variety' : factor}
                    </Text>
                    <Text style={[styles.factorScore, { color: ds.colors.textPrimary }]}>
                      {score}/25
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Expiration Timeline */}
        <View style={[styles.card, { backgroundColor: ds.colors.surface }]}>
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            EXPIRATION TIMELINE
          </Text>
          
          <TouchableOpacity 
            style={[styles.timelineRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
            onPress={() => navigation.navigate('Inventory' as never)}
            accessibilityLabel={`Expiring tomorrow: ${stats.expiring_tomorrow} items`}
            accessibilityHint="Double tap to view items expiring tomorrow"
            accessibilityRole="button"
          >
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: ds.colors.error }]} />
              <Text style={[styles.timelineLabel, { color: ds.colors.textPrimary }]}>Tomorrow</Text>
            </View>
            <View style={styles.timelineRight}>
              <Text style={[styles.timelineValue, { color: stats.expiring_tomorrow > 0 ? ds.colors.error : ds.colors.textSecondary }]}>
                {stats.expiring_tomorrow}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={ds.colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.timelineRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
            onPress={() => navigation.navigate('Inventory' as never)}
            accessibilityLabel={`Expiring this week: ${stats.expiring_this_week} items`}
            accessibilityHint="Double tap to view items expiring this week"
            accessibilityRole="button"
          >
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: ds.colors.warning }]} />
              <Text style={[styles.timelineLabel, { color: ds.colors.textPrimary }]}>This Week</Text>
            </View>
            <View style={styles.timelineRight}>
              <Text style={[styles.timelineValue, { color: stats.expiring_this_week > 0 ? ds.colors.warning : ds.colors.textSecondary }]}>
                {stats.expiring_this_week}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={ds.colors.textTertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.timelineRow}
            onPress={() => navigation.navigate('Inventory' as never)}
            accessibilityLabel={`Expiring this month: ${stats.expiring_this_month} items`}
            accessibilityHint="Double tap to view items expiring this month"
            accessibilityRole="button"
          >
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.timelineLabel, { color: ds.colors.textPrimary }]}>This Month</Text>
            </View>
            <View style={styles.timelineRight}>
              <Text style={[styles.timelineValue, { color: ds.colors.textSecondary }]}>
                {stats.expiring_this_month}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={ds.colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <View style={[styles.quickStatCard, { backgroundColor: ds.colors.surface }]}>
            <Text style={[styles.quickStatValue, { color: ds.colors.primary }]}>
              {stats.total_items}
            </Text>
            <Text style={[styles.quickStatLabel, { color: ds.colors.textSecondary }]}>
              Total Items
            </Text>
          </View>
          <View style={[styles.quickStatCard, { backgroundColor: ds.colors.surface }]}>
            <Text style={[styles.quickStatValue, { color: ds.colors.error }]}>
              {stats.expired}
            </Text>
            <Text style={[styles.quickStatLabel, { color: ds.colors.textSecondary }]}>
              Expired
            </Text>
          </View>
          <View style={[styles.quickStatCard, { backgroundColor: ds.colors.surface }]}>
            <Text style={[styles.quickStatValue, { color: ds.colors.warning }]}>
              {stats.low_stock}
            </Text>
            <Text style={[styles.quickStatLabel, { color: ds.colors.textSecondary }]}>
              Low Stock
            </Text>
          </View>
        </View>

        {/* Storage Distribution */}
        <View style={[styles.card, { backgroundColor: ds.colors.surface }]}>
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            STORAGE DISTRIBUTION
          </Text>
          
          {Object.entries(stats.storage_counts || {}).map(([location, count]) => {
            const icon = location === 'pantry' ? 'archive' : 
                        location === 'fridge' ? 'fridge' : 
                        location === 'freezer' ? 'snowflake' : 'help-circle';
            const color = location === 'pantry' ? '#8B5CF6' : 
                         location === 'fridge' ? '#3B82F6' : 
                         location === 'freezer' ? '#06B6D4' : ds.colors.textSecondary;
            return (
              <View key={location} style={styles.storageRow}>
                <View style={styles.storageLeft}>
                  <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                  <Text style={[styles.storageLabel, { color: ds.colors.textPrimary }]}>
                    {location.charAt(0).toUpperCase() + location.slice(1)}
                  </Text>
                </View>
                <View style={styles.storageRight}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <ProgressBar 
                      value={count} 
                      maxValue={totalStorage || 1}
                      color={color}
                      backgroundColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                    />
                  </View>
                  <Text style={[styles.storageCount, { color: ds.colors.textPrimary }]}>
                    {count}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Recipe Activity */}
        <View style={[styles.card, { backgroundColor: ds.colors.surface }]}>
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            RECIPE ACTIVITY
          </Text>
          
          <View style={styles.recipeStatsRow}>
            <View style={styles.recipeStat}>
              <MaterialCommunityIcons name="chef-hat" size={24} color={ds.colors.primary} />
              <Text style={[styles.recipeStatValue, { color: ds.colors.textPrimary }]}>
                {stats.recipes_generated}
              </Text>
              <Text style={[styles.recipeStatLabel, { color: ds.colors.textSecondary }]}>
                Generated
              </Text>
            </View>
            <View style={[styles.recipeDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
            <View style={styles.recipeStat}>
              <MaterialCommunityIcons name="bookmark" size={24} color={ds.colors.success} />
              <Text style={[styles.recipeStatValue, { color: ds.colors.textPrimary }]}>
                {stats.recipes_saved}
              </Text>
              <Text style={[styles.recipeStatLabel, { color: ds.colors.textSecondary }]}>
                Saved
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={[styles.card, { backgroundColor: ds.colors.surface }]}>
          <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
            RECENT ACTIVITY
          </Text>
          
          <View style={styles.activityRow}>
            <Text style={[styles.activityLabel, { color: ds.colors.textSecondary }]}>
              Items added this week
            </Text>
            <Text style={[styles.activityValue, { color: ds.colors.textPrimary }]}>
              {stats.items_added_this_week}
            </Text>
          </View>
          <View style={[styles.activityRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.activityLabel, { color: ds.colors.textSecondary }]}>
              Items added this month
            </Text>
            <Text style={[styles.activityValue, { color: ds.colors.textPrimary }]}>
              {stats.items_added_this_month}
            </Text>
          </View>
        </View>

        {/* Categories */}
        {Object.keys(stats.by_category || {}).length > 0 && (
          <View style={[styles.card, { backgroundColor: ds.colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: ds.colors.textTertiary }]}>
              BY CATEGORY
            </Text>
            
            {Object.entries(stats.by_category || {})
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([category, count], index, arr) => (
                <View 
                  key={category} 
                  style={[
                    styles.categoryRow,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
                    index === arr.length - 1 && { borderBottomWidth: 0 }
                  ]}
                >
                  <Text style={[styles.categoryLabel, { color: ds.colors.textPrimary }]}>
                    {category}
                  </Text>
                  <Text style={[styles.categoryCount, { color: ds.colors.primary }]}>
                    {count}
                  </Text>
                </View>
              ))}
          </View>
        )}

        <View style={{ height: 32 }} />
        </ScreenContentWrapper>
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  content: {
    padding: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  // Health Card
  healthCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  healthDetails: {
    flex: 1,
    marginLeft: 20,
  },
  healthLabel: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  healthFactors: {
    gap: 8,
  },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorLabel: {
    fontSize: 13,
  },
  factorScore: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Card
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  // Timeline
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  timelineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLabel: {
    fontSize: 16,
  },
  timelineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Quick Stats
  quickStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  quickStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  // Storage
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  storageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 100,
  },
  storageLabel: {
    fontSize: 15,
  },
  storageRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageCount: {
    fontSize: 16,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
  // Recipe Activity
  recipeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  recipeStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  recipeStatValue: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  recipeStatLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  recipeDivider: {
    width: 1,
    height: 60,
  },
  // Activity
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  activityLabel: {
    fontSize: 15,
  },
  activityValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Categories
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  categoryLabel: {
    fontSize: 15,
  },
  categoryCount: {
    fontSize: 18,
    fontWeight: '700',
  },
});
