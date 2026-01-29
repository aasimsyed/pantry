import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { AuthenticationType } from 'expo-local-authentication';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import { PremiumButton } from '../components/PremiumButton';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  MainTabs: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricCtaVisible, setBiometricCtaVisible] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<'Face ID' | 'Touch ID'>('Face ID');
  const [biometricLoading, setBiometricLoading] = useState(false);
  const { login, tryBiometricLogin } = useAuth();
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [enabled, available] = await Promise.all([
          apiClient.getBiometricEnabled(),
          apiClient.isBiometricAvailable(),
        ]);
        if (cancelled || !enabled || !available) {
          if (!cancelled) setBiometricCtaVisible(false);
          return;
        }
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const label = types.includes(AuthenticationType.FACIAL_RECOGNITION) ? 'Face ID' : 'Touch ID';
        if (!cancelled) {
          setBiometricLabel(label);
          setBiometricCtaVisible(true);
        }
      } catch {
        if (!cancelled) setBiometricCtaVisible(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      // Navigation will be handled by AppNavigator based on auth state
    } catch (err: any) {
      const isNetwork =
        err.code === 'ERR_NETWORK' ||
        err.message?.includes('Network Error') ||
        err.message?.includes('timeout');
      
      const errorDetail = err.response?.data?.detail || err.message || 'Login failed';
      
      // Check if it's an invalid credentials error
      if (errorDetail.toLowerCase().includes('incorrect') || 
          errorDetail.toLowerCase().includes('invalid') ||
          errorDetail.toLowerCase().includes('not found')) {
        setError('Invalid email or password');
      } else if (isNetwork) {
        setError("Can't reach API. Is the backend running? (Physical device? Use Mac IP — see terminal.)");
      } else {
        setError(errorDetail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 16, paddingHorizontal: layout.horizontalPadding },
            layout.isTablet && { alignItems: 'center' },
          ]}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.card, layout.isTablet && styles.cardTablet, { backgroundColor: ds.colors.surface, ...ds.shadows.lg }]}>
          <Card.Content style={[styles.cardContent, layout.isTablet && styles.cardContentTablet]}>
            <View style={styles.logoContainer}>
              <View style={[styles.logoCircle, { backgroundColor: ds.colors.primary }]}>
                <MaterialCommunityIcons name="food-variant" size={40} color="#FFFFFF" />
              </View>
            </View>
            
            <Text testID="login-title" style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
              Welcome Back
            </Text>
            <Text testID="login-subtitle" style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
              Sign in to continue to Smart Pantry
            </Text>

            {error && (
              <View style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ef4444" />
                <Text style={[styles.errorText, { color: '#ef4444' }]}>
                  {error}
                </Text>
              </View>
            )}

            <TextInput
              testID="email-input"
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="email-outline" />}
              accessibilityLabel="Email"
              accessibilityHint="Double tap to enter your email"
              accessibilityRole="none"
            />

            <TextInput
              testID="password-input"
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="lock-outline" />}
              accessibilityLabel="Password"
              accessibilityHint="Double tap to enter your password"
              accessibilityRole="none"
            />

            {biometricCtaVisible && (
              <>
                <PremiumButton
                  testID="biometric-login-button"
                  mode="outlined"
                  onPress={async () => {
                    setError(null);
                    setBiometricLoading(true);
                    try {
                      const ok = await tryBiometricLogin();
                      if (!ok) {
                        setError('Sign in with your email and password first. Then Face ID will work next time.');
                      }
                    } catch {
                      setError('Something went wrong. Try signing in with your email and password.');
                    } finally {
                      setBiometricLoading(false);
                    }
                  }}
                  loading={biometricLoading}
                  disabled={loading || biometricLoading}
                  style={styles.biometricButton}
                  icon="face-recognition"
                >
                  Sign in with {biometricLabel}
                </PremiumButton>
                <Text style={[styles.biometricHint, { color: ds.colors.textSecondary }]}>
                  Sign in with your password first; then you can use this next time.
                </Text>
              </>
            )}

            <Button
              mode="text"
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotPasswordButton}
              labelStyle={styles.forgotPasswordLabel}
              compact
            >
              Forgot Password?
            </Button>

            <PremiumButton
              testID="login-button"
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading || biometricLoading}
              style={styles.button}
            >
              Sign In
            </PremiumButton>

            <Button
              testID="register-link"
              mode="text"
              onPress={() => navigation.navigate('Register')}
              style={styles.linkButton}
              labelStyle={styles.linkButtonLabel}
            >
              Don't have an account? Sign up
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 24,
  },
  cardTablet: {
    maxWidth: 560,
    width: '100%',
    borderRadius: 28,
  },
  cardContent: {
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  cardContentTablet: {
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleTablet: {
    fontSize: 32,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
  subtitleTablet: {
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 40,
  },
  input: {
    marginBottom: 16,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotPasswordLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  biometricButton: {
    marginBottom: 4,
  },
  biometricHint: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 8,
  },
  linkButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});

