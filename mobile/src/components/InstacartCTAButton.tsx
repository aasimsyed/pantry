import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

/**
 * Instacart CTA button, Dark theme.
 * Spec: https://docs.instacart.com/developer_platform_api/guide/concepts/design/cta_design
 */
const DARK_BACKGROUND = '#003D29';
const DARK_FOREGROUND = '#FAF1E5';
const LOGO_HEIGHT = 22;
const LOGO_ASPECT_RATIO = 500 / 572;

interface InstacartCTAButtonProps {
  label: 'Shop ingredients' | 'Shop on Instacart';
  onPress: () => void;
  loading?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
}

export const InstacartCTAButton: React.FC<InstacartCTAButtonProps> = ({
  label,
  onPress,
  loading = false,
  accessibilityHint,
  style,
}) => (
  <TouchableOpacity
    style={[styles.button, style]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled: loading, busy: loading }}
  >
    {loading ? (
      <ActivityIndicator size="small" color={DARK_FOREGROUND} />
    ) : (
      <>
        <Image
          source={require('../../assets/instacart-carrot.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.label}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    height: 46,
    minWidth: 180,
    paddingHorizontal: 18,
    borderRadius: 29.5,
    backgroundColor: DARK_BACKGROUND,
    gap: 10,
  },
  logo: {
    height: LOGO_HEIGHT,
    width: LOGO_HEIGHT * LOGO_ASPECT_RATIO,
  },
  label: {
    color: DARK_FOREGROUND,
    fontSize: 16,
    fontWeight: '600',
  },
});
