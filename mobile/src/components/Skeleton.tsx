import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const { isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            opacity,
            transform: [{ translateX }],
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.8)',
          },
        ]}
      />
    </View>
  );
}

export function SkeletonRecipeCard() {
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);

  return (
    <View style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
      <View style={styles.cardContent}>
        <Skeleton width="80%" height={28} borderRadius={8} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={16} borderRadius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="90%" height={16} borderRadius={6} style={{ marginBottom: 20 }} />
        
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Skeleton width={40} height={24} borderRadius={6} />
            <Skeleton width={50} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
          <View style={styles.metaItem}>
            <Skeleton width={40} height={24} borderRadius={6} />
            <Skeleton width={50} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
          <View style={styles.metaItem}>
            <Skeleton width={40} height={24} borderRadius={6} />
            <Skeleton width={50} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Skeleton width="48%" height={48} borderRadius={14} />
          <Skeleton width="48%" height={48} borderRadius={14} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  metaItem: {
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
});

/** Skeleton row for inventory list loading state. */
export function SkeletonInventoryRow() {
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);

  return (
    <View style={[styles.inventoryRow, { backgroundColor: ds.colors.surface }]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Skeleton width="70%" height={16} borderRadius={6} />
        <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
      <Skeleton width={48} height={24} borderRadius={8} />
    </View>
  );
}
