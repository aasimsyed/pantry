import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import { PremiumButton } from '../components/PremiumButton';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'general' | 'email' | 'password'>('general');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const navigation = useNavigation<NavigationProp>();

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      setErrorType('general');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setErrorType('password');
      return;
    }

    setError(null);
    setErrorType('general');
    setLoading(true);

    try {
      await register({
        email,
        password,
        full_name: fullName || undefined,
      });
      // Navigation will be handled by AppNavigator based on auth state
    } catch (err: any) {
      const isNetwork =
        err.code === 'ERR_NETWORK' ||
        err.message?.includes('Network Error') ||
        err.message?.includes('timeout');
      
      const errorDetail = err.response?.data?.detail || err.message || 'Registration failed';
      
      // Check if it's an email already registered error
      if (errorDetail.toLowerCase().includes('email already registered') || 
          errorDetail.toLowerCase().includes('already exists')) {
        setError('This email is already registered');
        setErrorType('email');
      } else if (isNetwork) {
        setError("Can't reach API. Is the backend running? (Physical device? Use Mac IP — see terminal.)");
        setErrorType('general');
      } else {
        setError(errorDetail);
        setErrorType('general');
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
              <View style={[styles.logoCircle, { backgroundColor: ds.colors.accent }]}>
                <MaterialCommunityIcons name="account-plus" size={40} color="#FFFFFF" />
              </View>
            </View>
            
            <Text testID="register-title" style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
              Get Started
            </Text>
            <Text testID="register-subtitle" style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
              Create your Smart Pantry account
            </Text>

            {errorType === 'general' && error && (
              <View style={[styles.generalErrorContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ef4444" />
                <Text style={[styles.generalErrorText, { color: '#ef4444' }]}>
                  {error}
                </Text>
              </View>
            )}

            <TextInput
              testID="full-name-input"
              label="Full Name (Optional)"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account-outline" />}
              accessibilityLabel="Full name"
              accessibilityRole="none"
            />

            <TextInput
              testID="email-input"
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorType === 'email') {
                  setError(null);
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              mode="outlined"
              style={styles.input}
              error={errorType === 'email'}
              left={<TextInput.Icon icon="email-outline" />}
              accessibilityLabel="Email"
              accessibilityRole="none"
            />
            {errorType === 'email' && error && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" />
                <View style={styles.errorTextContainer}>
                  <Text style={[styles.errorText, { color: '#ef4444' }]}>
                    {error}
                  </Text>
                  <Button
                    mode="text"
                    onPress={() => navigation.navigate('Login')}
                    style={styles.errorButton}
                    labelStyle={styles.errorButtonLabel}
                    compact
                    accessibilityLabel="Sign in instead"
                    accessibilityRole="button"
                  >
                    Sign in instead
                  </Button>
                </View>
              </View>
            )}

            <TextInput
              testID="password-input"
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorType === 'password') {
                  setError(null);
                }
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              mode="outlined"
              style={styles.input}
              error={errorType === 'password'}
              left={<TextInput.Icon icon="lock-outline" />}
              accessibilityLabel="Password"
              accessibilityRole="none"
            />
            <Text style={[styles.helperText, { color: ds.colors.textTertiary }]}>
              Must be at least 8 characters
            </Text>
            {errorType === 'password' && error && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" />
                <Text style={[styles.errorText, { color: '#ef4444' }]}>
                  {error}
                </Text>
              </View>
            )}

            <PremiumButton
              testID="register-button"
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
              accessibilityLabel="Create account"
              accessibilityRole="button"
            >
              Create Account
            </PremiumButton>

            <Button
              testID="login-link"
              mode="text"
              accessibilityLabel="Sign in"
              accessibilityRole="button"
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
              labelStyle={styles.linkButtonLabel}
            >
              Already have an account? Sign in
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
  helperText: {
    fontSize: 13,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  linkButton: {
    marginTop: 8,
  },
  linkButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  generalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  generalErrorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    gap: 6,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  errorButton: {
    marginTop: 4,
    marginLeft: -8,
  },
  errorButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

