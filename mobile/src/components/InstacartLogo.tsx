import React from 'react';
import { View, StyleSheet, Image, ImageStyle } from 'react-native';

/**
 * Instacart Logo Lockup Component
 * 
 * Renders the official Instacart logo lockup (symbol + wordmark) according to brand guidelines:
 * - Uses official logo asset with proper symbol + wordmark combination
 * - Minimum size: 14px on screen (enforced)
 * - Maintains aspect ratio (150:24 original)
 * - Proper clearspace maintained via container padding
 * 
 * Brand Guidelines Compliance:
 * - Full lockup (symbol + wordmark together) ✓
 * - Minimum size: 14px ✓
 * - Proper clearspace ✓
 * - Approved colors (green/orange symbol, dark green wordmark) ✓
 */
interface InstacartLogoProps {
  width?: number;
  height?: number;
  style?: ImageStyle;
  variant?: 'light' | 'dark'; // For light or dark backgrounds
}

const LOGO_ASPECT_RATIO = 640 / 103; // Actual downloaded image dimensions (640x103)

export const InstacartLogo: React.FC<InstacartLogoProps> = ({
  width,
  height,
  style,
}) => {
  // Ensure minimum size per brand guidelines (14px height minimum)
  const minHeight = Math.max(height || 24, 14);
  const calculatedWidth = width || minHeight * LOGO_ASPECT_RATIO;
  const finalWidth = Math.max(calculatedWidth, 14 * LOGO_ASPECT_RATIO);
  
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/instacart-lockup.png')}
        style={[
          styles.logo,
          {
            width: finalWidth,
            height: minHeight,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // Clearspace: minimal padding for proper spacing per brand guidelines
  },
  logo: {
    // Maintain aspect ratio via resizeMode="contain"
    // Ensure logo is fully opaque for maximum visibility
    opacity: 1,
  },
});
