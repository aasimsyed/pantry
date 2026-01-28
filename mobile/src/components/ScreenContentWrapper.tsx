import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useLayout } from '../hooks/useLayout';

/**
 * Wraps screen content for iPad: constrains max width and centers.
 * Caller should set paddingHorizontal from useLayout().horizontalPadding so tablet gets generous gutters.
 * iPhone: full width. Rams/Ive: purposeful use of space on tablet.
 */
export function ScreenContentWrapper({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const layout = useLayout();
  const wrapperStyle: ViewStyle[] = [styles.wrapper];
  if (layout.contentMaxWidth != null) {
    wrapperStyle.push({ maxWidth: layout.contentMaxWidth });
  }
  return <View style={[wrapperStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignSelf: 'center',
  },
});
