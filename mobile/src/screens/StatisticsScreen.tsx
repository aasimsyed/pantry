import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { Card, Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import type { Statistics } from '../types';

export default function StatisticsScreen() {
  const { isDark } = useTheme();
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ds.colors.primary} />
          <Text style={[styles.loadingText, { color: ds.colors.textSecondary }]}>Loading statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={{ color: ds.colors.textSecondary }}>No statistics available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getLocationIcon = (location: string) => {
    switch (location) {
      case 'pantry': return 'archive';
      case 'fridge': return 'fridge';
      case 'freezer': return 'snowflake';
      default: return 'map-marker';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text testID="statistics-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
          Statistics
        </Text>

        <View style={styles.metricsContainer}>
          <Card style={[styles.metricCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
            <Card.Content style={styles.metricContent}>
              <View style={[styles.metricIconContainer, { backgroundColor: `${ds.colors.primary}15` }]}>
                <MaterialCommunityIcons name="package-variant" size={24} color={ds.colors.primary} />
              </View>
              <Text style={[styles.metricValue, { color: ds.colors.primary }]}>
                {stats.total_items}
              </Text>
              <Text style={[styles.metricLabel, { color: ds.colors.textSecondary }]}>Total Items</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.metricCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
            <Card.Content style={styles.metricContent}>
              <View style={[styles.metricIconContainer, { backgroundColor: `${ds.colors.success}15` }]}>
                <MaterialCommunityIcons name="check-circle" size={24} color={ds.colors.success} />
              </View>
              <Text style={[styles.metricValue, { color: ds.colors.success }]}>
                {stats.in_stock}
              </Text>
              <Text style={[styles.metricLabel, { color: ds.colors.textSecondary }]}>In Stock</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.metricCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
            <Card.Content style={styles.metricContent}>
              <View style={[styles.metricIconContainer, { backgroundColor: `${ds.colors.warning}15` }]}>
                <MaterialCommunityIcons name="clock-alert" size={24} color={ds.colors.warning} />
              </View>
              <Text style={[styles.metricValue, { color: ds.colors.warning }]}>
                {stats.expiring_soon}
              </Text>
              <Text style={[styles.metricLabel, { color: ds.colors.textSecondary }]}>Expiring</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.metricCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
            <Card.Content style={styles.metricContent}>
              <View style={[styles.metricIconContainer, { backgroundColor: `${ds.colors.error}15` }]}>
                <MaterialCommunityIcons name="alert-circle" size={24} color={ds.colors.error} />
              </View>
              <Text style={[styles.metricValue, { color: ds.colors.error }]}>
                {stats.expired}
              </Text>
              <Text style={[styles.metricLabel, { color: ds.colors.textSecondary }]}>Expired</Text>
            </Card.Content>
          </Card>
        </View>

        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons name="tag-multiple" size={22} color={ds.colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                By Category
              </Text>
            </View>
            {Object.entries(stats.by_category || {})
              .sort(([, a], [, b]) => b - a)
              .map(([category, count], index, arr) => (
                <View 
                  key={category} 
                  style={[
                    styles.statRow, 
                    { borderBottomColor: ds.colors.surfaceHover },
                    index === arr.length - 1 && { borderBottomWidth: 0 }
                  ]}
                >
                  <Text style={[styles.statLabel, { color: ds.colors.textPrimary }]}>
                    {category || 'Uncategorized'}
                  </Text>
                  <Text style={[styles.statValue, { color: ds.colors.primary }]}>
                    {count}
                  </Text>
                </View>
              ))}
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons name="map-marker" size={22} color={ds.colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                By Location
              </Text>
            </View>
            {Object.entries(stats.by_location || {})
              .sort(([, a], [, b]) => b - a)
              .map(([location, count], index, arr) => (
                <View 
                  key={location} 
                  style={[
                    styles.statRow, 
                    { borderBottomColor: ds.colors.surfaceHover },
                    index === arr.length - 1 && { borderBottomWidth: 0 }
                  ]}
                >
                  <View style={styles.locationRow}>
                    <MaterialCommunityIcons 
                      name={getLocationIcon(location)} 
                      size={18} 
                      color={ds.colors.textSecondary} 
                    />
                    <Text style={[styles.statLabel, styles.capitalize, { color: ds.colors.textPrimary }]}>
                      {location}
                    </Text>
                  </View>
                  <Text style={[styles.statValue, { color: ds.colors.primary }]}>
                    {count}
                  </Text>
                </View>
              ))}
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons name="chart-pie" size={22} color={ds.colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                By Status
              </Text>
            </View>
            {Object.entries(stats.by_status || {})
              .sort(([, a], [, b]) => b - a)
              .map(([status, count], index, arr) => (
                <View 
                  key={status} 
                  style={[
                    styles.statRow, 
                    { borderBottomColor: ds.colors.surfaceHover },
                    index === arr.length - 1 && { borderBottomWidth: 0 }
                  ]}
                >
                  <Text style={[styles.statLabel, { color: ds.colors.textPrimary }]}>
                    {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                  <Text style={[styles.statValue, { color: ds.colors.primary }]}>
                    {count}
                  </Text>
                </View>
              ))}
          </Card.Content>
        </Card>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  metricCard: {
    width: '47%',
    borderRadius: 20,
  },
  metricContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
  },
  cardContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 15,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  capitalize: {
    textTransform: 'capitalize',
  },
});

