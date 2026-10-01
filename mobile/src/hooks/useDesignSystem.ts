import { PixelRatio } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem, getTextStyle as getTextStyleBase } from '../utils/designSystem';

/**
 * Hook to get theme-aware design system with Dynamic Type support (WCAG 1.4.4).
 * Typography scales with system font size (PixelRatio.getFontScale()).
 */
export function useDesignSystem() {
  const { isDark } = useTheme();
  const fontScale = PixelRatio.getFontScale();
  const ds = getDesignSystem(isDark, fontScale);

  return {
    ...ds,
    getTextStyle: (variant: keyof typeof ds.typography, color?: string) =>
      getTextStyleBase(variant, color, isDark, fontScale),
  };
}
