import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { getDesignSystem } from './designSystem';

export const getTheme = (isDark: boolean = false) => {
  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
  const ds = getDesignSystem(isDark);

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: ds.colors.primary,
      secondary: ds.colors.accent,
      background: ds.colors.background,
      surface: ds.colors.surface,
      error: ds.colors.error,
      onPrimary: ds.colors.textInverse,
      onSecondary: ds.colors.textInverse,
      onBackground: ds.colors.textPrimary,
      onSurface: ds.colors.textPrimary,
    },
  };
};

// Legacy export for backward compatibility
export const theme = getTheme(false);

