/**
 * Modern Design System
 * Inspired by Jony Ive's design philosophy: simplicity, elegance, depth
 * 
 * Features:
 * - 3D depth through layered shadows and gradients
 * - Refined typography with proper hierarchy
 * - Premium color palette
 * - Spacious, breathable layouts
 * - Dark mode support
 */

// Light Theme Colors
const lightColors = {
  // Primary - Deep, rich blues
  primary: '#0A2540',
  primaryLight: '#1E3A5F',
  primaryDark: '#051829',
  
  // Accent - Warm, inviting
  accent: '#FF6B35',
  accentLight: '#FF8C61',
  accentDark: '#E55A2B',
  
  // Neutrals - Sophisticated grays
  background: '#FAFBFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHover: '#F8F9FA',
  
  // Text - High contrast, readable
  textPrimary: '#1A1F2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  
  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Storage locations
  pantry: '#D97706', // Warm amber
  fridge: '#0EA5E9', // Cool cyan
  freezer: '#6366F1', // Deep indigo
};

// Dark Theme Colors
const darkColors = {
  // Primary - Lighter blues for dark mode
  primary: '#4A9EFF',
  primaryLight: '#6BB3FF',
  primaryDark: '#2B7FE0',
  
  // Accent - Slightly adjusted for dark mode
  accent: '#FF8C61',
  accentLight: '#FFA882',
  accentDark: '#FF6B35',
  
  // Neutrals - Dark grays
  background: '#0F1419',
  surface: '#1A1F2E',
  surfaceElevated: '#252B3A',
  surfaceHover: '#2A3142',
  
  // Text - Light colors for dark backgrounds
  textPrimary: '#F5F7FA',
  textSecondary: '#A0AEC0',
  textTertiary: '#718096',
  textInverse: '#1A1F2E',
  
  // Semantic - Slightly adjusted for dark mode
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',
  
  // Storage locations - Adjusted for dark mode
  pantry: '#F59E0B', // Brighter amber
  fridge: '#38BDF8', // Brighter cyan
  freezer: '#818CF8', // Brighter indigo
};

export const getDesignSystem = (isDark: boolean = false) => {
  return {
  // Color Palette - Modern, sophisticated
  colors: isDark ? darkColors : lightColors,

  // Typography - Modern, readable hierarchy
  typography: {
    // Display - Large, bold, impactful
    display: {
      fontSize: 36,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
      lineHeight: 44,
    },
    
    // Headline - Section titles
    headline: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: -0.3,
      lineHeight: 36,
    },
    
    // Title - Card titles, important text
    title: {
      fontSize: 20,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
      lineHeight: 28,
    },
    
    // Body - Main content
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      letterSpacing: 0,
      lineHeight: 24,
    },
    
    // Caption - Small text, metadata
    caption: {
      fontSize: 14,
      fontWeight: '400' as const,
      letterSpacing: 0.1,
      lineHeight: 20,
    },
    
    // Label - Form labels, buttons
    label: {
      fontSize: 14,
      fontWeight: '500' as const,
      letterSpacing: 0.2,
      lineHeight: 20,
    },
  },

  // Spacing - 8px grid system
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Shadows - Layered depth (3D effect) - Adjusted for dark mode
  shadows: {
    // Subtle elevation
    sm: {
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    
    // Medium elevation
    md: {
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    
    // Large elevation
    lg: {
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.5 : 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    
    // Extra large - Floating elements
    xl: {
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.6 : 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    
    // Inner shadow for depth
    inner: {
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 0,
    },
  },

  // Border Radius - Modern, soft curves
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  // Gradients - Subtle depth (theme-aware)
  gradients: {
    primary: isDark ? ['#4A9EFF', '#6BB3FF'] : ['#0A2540', '#1E3A5F'],
    accent: isDark ? ['#FF8C61', '#FFA882'] : ['#FF6B35', '#FF8C61'],
    surface: isDark ? ['#1A1F2E', '#252B3A'] : ['#FFFFFF', '#F8F9FA'],
    overlay: isDark 
      ? ['rgba(26, 31, 46, 0.9)', 'rgba(26, 31, 46, 0.95)']
      : ['rgba(10, 37, 64, 0.8)', 'rgba(10, 37, 64, 0.95)'],
  },

  // Animation - Smooth, natural
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
    easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
  };
};

// Helper function to create gradient styles
export const createGradient = (colors: string[]) => ({
  colors,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
});

// Legacy export for backward compatibility (uses light theme)
export const DesignSystem = getDesignSystem(false);

// Helper for text styles (theme-aware)
export const getTextStyle = (
  variant: keyof typeof DesignSystem.typography, 
  color?: string,
  isDark: boolean = false
) => {
  const ds = getDesignSystem(isDark);
  return {
    ...ds.typography[variant],
    color: color || ds.colors.textPrimary,
  };
};
