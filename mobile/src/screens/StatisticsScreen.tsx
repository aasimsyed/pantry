import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { Card, Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text>No statistics available</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
      <Text variant="titleLarge" style={styles.title}>
        Pantry Statistics
      </Text>

      <View style={styles.metricsContainer}>
        <Card style={styles.metricCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.metricValue}>
              {stats.total_items}
            </Text>
            <Text variant="bodyMedium">Total Items</Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={[styles.metricValue, styles.green]}>
              {stats.in_stock}
            </Text>
            <Text variant="bodyMedium">In Stock</Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={[styles.metricValue, styles.orange]}>
              {stats.expiring_soon}
            </Text>
            <Text variant="bodyMedium">Expiring Soon</Text>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={[styles.metricValue, styles.red]}>
              {stats.expired}
            </Text>
            <Text variant="bodyMedium">Expired</Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            By Category
          </Text>
          {Object.entries(stats.by_category || {})
            .sort(([, a], [, b]) => b - a)
            .map(([category, count]) => (
              <View key={category} style={styles.statRow}>
                <Text variant="bodyMedium">{category || 'Uncategorized'}</Text>
                <Text variant="bodyLarge" style={styles.statValue}>
                  {count}
                </Text>
              </View>
            ))}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            By Location
          </Text>
          {Object.entries(stats.by_location || {})
            .sort(([, a], [, b]) => b - a)
            .map(([location, count]) => (
              <View key={location} style={styles.statRow}>
                <Text variant="bodyMedium" style={styles.capitalize}>
                  {location}
                </Text>
                <Text variant="bodyLarge" style={styles.statValue}>
                  {count}
                </Text>
              </View>
            ))}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            By Status
          </Text>
          {Object.entries(stats.by_status || {})
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <View key={status} style={styles.statRow}>
                <Text variant="bodyMedium">
                  {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Text>
                <Text variant="bodyLarge" style={styles.statValue}>
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
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    marginBottom: 12,
    elevation: 2,
  },
  metricValue: {
    fontWeight: 'bold',
    color: '#0284c7',
    textAlign: 'center',
  },
  green: {
    color: '#10b981',
  },
  orange: {
    color: '#f97316',
  },
  red: {
    color: '#ef4444',
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statValue: {
    fontWeight: '600',
    color: '#0284c7',
  },
  capitalize: {
    textTransform: 'capitalize',
  },
});

