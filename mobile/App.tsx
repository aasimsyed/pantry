import React from 'react';
import { StatusBar } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { OfflineBanner } from './src/components/OfflineBanner';
import { getTheme } from './src/utils/theme';
import { getDesignSystem } from './src/utils/designSystem';

function AppContent() {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const ds = getDesignSystem(isDark);

  return (
    <>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={ds.colors.background}
        translucent={false}
      />
      <PaperProvider theme={theme}>
        <AuthProvider>
          <AppNavigator />
          <OfflineBanner />
        </AuthProvider>
      </PaperProvider>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
