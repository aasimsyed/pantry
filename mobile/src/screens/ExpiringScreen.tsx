import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SectionList, StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import apiClient from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import { ScreenContentWrapper } from '../components/ScreenContentWrapper';
import { Skeleton } from '../components/Skeleton';
import type { InventoryItem } from '../types';

type ExpiringSection = { id: string; title: string; isError: boolean; data: (InventoryItem & { _empty?: boolean })[] };

export default function ExpiringScreen() {
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
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

  const sections = useMemo<ExpiringSection[]>(() => {
    const result: ExpiringSection[] = [];
    if (expiredItems.length > 0) {
      result.push({ id: 'expired', title: 'Expired', isError: true, data: expiredItems });
    }
    result.push({
      id: 'expiring',
      title: 'Expiring Soon',
      isError: false,
      data: expiringItems.length === 0 ? [{ id: -1, product_name: '', _empty: true } as InventoryItem & { _empty?: boolean }] : expiringItems,
    });
    return result;
  }, [expiredItems, expiringItems]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: ExpiringSection }) => (
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionBadge,
            {
              backgroundColor: section.isError
                ? isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'
                : isDark ? 'rgba(249, 115, 22, 0.2)' : '#fff7ed',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={section.isError ? 'alert-circle' : 'clock-alert'}
            size={20}
            color={section.isError ? ds.colors.error : ds.colors.warning}
          />
          <Text style={[styles.sectionBadgeText, { color: section.isError ? ds.colors.error : ds.colors.warning }]}>
            {section.title}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: section.isError ? ds.colors.error : ds.colors.warning }]}>
            <Text style={styles.countText}>
              {section.data[0]?._empty ? 0 : section.data.length}
            </Text>
          </View>
        </View>
      </View>
    ),
    [isDark, ds.colors]
  );

  const renderItem = useCallback(
    ({ item, section }: { item: InventoryItem & { _empty?: boolean }; section: ExpiringSection }) => {
      if (item._empty) {
        return (
          <Card style={[styles.successCard, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', ...ds.shadows.sm }]}>
            <Card.Content style={styles.successContent}>
              <MaterialCommunityIcons name="check-circle" size={48} color={ds.colors.success} />
              <Text style={[styles.successTitle, { color: ds.colors.success }]}>All Clear!</Text>
              <Text style={[styles.successText, { color: ds.colors.textSecondary }]}>
                No items expiring in the next {days} days
              </Text>
            </Card.Content>
          </Card>
        );
      }
      const isErrorSection = section.isError;
      return (
        <Card
          style={[
            styles.itemCard,
            {
              backgroundColor: isErrorSection ? (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2') : isDark ? 'rgba(249, 115, 22, 0.1)' : '#fff7ed',
              borderLeftColor: isErrorSection ? ds.colors.error : ds.colors.warning,
            },
          ]}
        >
          <Card.Content style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text style={[styles.itemName, { color: ds.colors.textPrimary }]}>{item.product_name || 'Unknown'}</Text>
              <Text style={[styles.itemDate, { color: isErrorSection ? ds.colors.error : ds.colors.warning }]}>
                {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemQuantity, { color: ds.colors.textSecondary }]}>
                {item.quantity} {item.unit}
              </Text>
              <View style={styles.itemLocation}>
                <MaterialCommunityIcons
                  name={item.storage_location === 'pantry' ? 'archive' : item.storage_location === 'fridge' ? 'fridge' : 'snowflake'}
                  size={14}
                  color={ds.colors.textTertiary}
                />
                <Text style={[styles.itemLocationText, { color: ds.colors.textTertiary }]}>{item.storage_location}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      );
    },
    [isDark, days, ds.colors]
  );

  const keyExtractor = useCallback((item: InventoryItem & { _empty?: boolean }) => (item._empty ? 'empty' : String(item.id)), []);

  const listHeaderComponent = useMemo(
    () => (
      <ScreenContentWrapper>
        <Text testID="expiring-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
          Expiring Items
        </Text>
        <Card style={[styles.sliderCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.sliderContent}>
            <View style={styles.sliderHeader}>
              <View style={[styles.sliderIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons name="calendar-clock" size={24} color={ds.colors.primary} />
              </View>
              <View style={styles.sliderTextContainer}>
                <Text style={[styles.sliderLabel, { color: ds.colors.textPrimary }]}>Look ahead</Text>
                <Text style={[styles.sliderValue, { color: ds.colors.primary }]}>{days} days</Text>
              </View>
            </View>
            <Slider
              testID="expiring-days-slider"
              value={days}
              onValueChange={setDays}
              minimumValue={1}
              maximumValue={30}
              step={1}
              minimumTrackTintColor={ds.colors.primary}
              maximumTrackTintColor={ds.colors.surfaceHover}
              thumbTintColor={ds.colors.primary}
              style={styles.slider}
            />
          </Card.Content>
        </Card>
      </ScreenContentWrapper>
    ),
    [days, ds.colors]
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <View style={[styles.content, layout.isTablet && { paddingHorizontal: layout.horizontalPadding }]}>
          <Skeleton width="40%" height={32} borderRadius={8} style={{ marginBottom: 20 }} />
          <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 24 }} />
          <Skeleton width="60%" height={20} borderRadius={6} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={72} borderRadius={12} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={72} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={listHeaderComponent}
        contentContainerStyle={[
          styles.content,
          layout.isTablet && { paddingHorizontal: layout.horizontalPadding },
        ]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
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
  sliderCard: {
    borderRadius: 20,
    marginBottom: 24,
  },
  sliderContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  sliderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderTextContainer: {
    flex: 1,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sliderValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  slider: {
    height: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  sectionBadgeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  itemCard: {
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  itemContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 12,
  },
  itemDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 14,
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemLocationText: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  successCard: {
    borderRadius: 20,
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    textAlign: 'center',
  },
});

