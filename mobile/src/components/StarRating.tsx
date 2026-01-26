import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  color?: string;
}

export default function StarRating({
  rating,
  onRatingChange,
  size = 24,
  readonly = false,
  color = '#f59e0b',
}: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  const handlePress = (star: number) => {
    if (!readonly && onRatingChange) {
      // Toggle: if clicking the same rating, clear it
      onRatingChange(rating === star ? 0 : star);
    }
  };

  return (
    <View style={styles.container}>
      {stars.map((star) => {
        const filled = star <= rating;
        const StarComponent = readonly ? View : TouchableOpacity;

        return (
          <StarComponent
            key={star}
            onPress={() => handlePress(star)}
            style={styles.star}
            {...(readonly ? {} : { activeOpacity: 0.7 })}
          >
            <Text style={{ fontSize: size, color: filled ? color : '#d1d5db' }}>
              {filled ? '★' : '☆'}
            </Text>
          </StarComponent>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginHorizontal: 2,
  },
});
