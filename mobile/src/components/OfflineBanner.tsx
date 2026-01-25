import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';

/**
 * Component to display offline status banner
 * Shows a snackbar when offline or when coming back online
 */
export function OfflineBanner() {
  const { isOnline, message } = useOfflineStatus();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const [visible, setVisible] = React.useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [message, fadeAnim]);

  if (!message || !visible) return null;

  return (
    <Snackbar
      visible={visible}
      onDismiss={() => setVisible(false)}
      duration={isOnline ? 3000 : 0} // 0 = indefinite
      style={{
        backgroundColor: isOnline ? ds.colors.success : ds.colors.error,
      }}
      action={{
        label: 'Dismiss',
        onPress: () => setVisible(false),
        textColor: ds.colors.surface,
      }}
    >
      <Text style={{ color: ds.colors.surface }}>{message}</Text>
    </Snackbar>
  );
}
