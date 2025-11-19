import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text, ActivityIndicator } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import apiClient from '../api/client';
import type { InventoryItem } from '../types';

export default function ExpiringScreen() {
  const [expiringItems, setExpiringItems] = useState<InventoryItem[]>([]);
  const [expiredItems, setExpiredItems] = useState<InventoryItem[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpiringItems();
    loadExpiredItems();
  }, [days]);

  const loadExpiringItems = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getExpiringItems(days);
      setExpiringItems(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load expiring items');
    } finally {
      setLoading(false);
    }
  };

  const loadExpiredItems = async () => {
    try {
      const data = await apiClient.getExpiredItems();
      setExpiredItems(data);
    } catch (err: any) {
      console.error('Failed to load expired items:', err);
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
        Expiring Items
      </Text>

      <View style={styles.sliderContainer}>
        <Text variant="bodyMedium">Days ahead: {days}</Text>
        <Slider
          value={days}
          onValueChange={setDays}
          minimumValue={1}
          maximumValue={30}
          step={1}
        />
      </View>

      {expiredItems.length > 0 && (
        <View>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            ❌ Expired ({expiredItems.length})
          </Text>
          {expiredItems.map((item) => (
            <Card key={item.id} style={[styles.card, styles.expiredCard]}>
              <Card.Content>
                <Text variant="titleMedium">{item.product_name || 'Unknown'}</Text>
                <Text variant="bodySmall" style={styles.expiredText}>
                  Expired: {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : 'N/A'}
                </Text>
                <Text variant="bodySmall">
                  {item.quantity} {item.unit} • 📍 {item.storage_location}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      <Text variant="titleMedium" style={styles.sectionTitle}>
        ⚠️ Expiring in {days} days ({expiringItems.length})
      </Text>

      {expiringItems.length === 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyLarge" style={styles.successText}>
              No items expiring in the next {days} days! 🎉
            </Text>
          </Card.Content>
        </Card>
      ) : (
        expiringItems.map((item) => (
          <Card key={item.id} style={[styles.card, styles.expiringCard]}>
            <Card.Content>
              <Text variant="titleMedium">{item.product_name || 'Unknown'}</Text>
              <Text variant="bodySmall" style={styles.expiringText}>
                Expires: {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : 'N/A'}
              </Text>
              <Text variant="bodySmall">
                {item.quantity} {item.unit} • 📍 {item.storage_location}
              </Text>
            </Card.Content>
          </Card>
        ))
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
  sliderContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 2,
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
  expiredCard: {
    backgroundColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  expiringCard: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  expiredText: {
    color: '#dc2626',
    fontWeight: '600',
    marginTop: 4,
  },
  expiringText: {
    color: '#ea580c',
    fontWeight: '600',
    marginTop: 4,
  },
  successText: {
    color: '#10b981',
    textAlign: 'center',
  },
});

