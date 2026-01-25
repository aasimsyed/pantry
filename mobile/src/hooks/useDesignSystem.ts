import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem, getTextStyle as getTextStyleBase } from '../utils/designSystem';

/**
 * Hook to get theme-aware design system
 * Use this in components instead of importing DesignSystem directly
 */
export function useDesignSystem() {
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);

  return {
    ...ds,
    getTextStyle: (variant: keyof typeof ds.typography, color?: string) =>
      getTextStyleBase(variant, color, isDark),
  };
}
