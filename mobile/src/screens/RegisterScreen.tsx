import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const navigation = useNavigation<NavigationProp>();

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setError(null);
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
      setError(
        isNetwork
          ? "Can't reach API. Is the backend running? (Physical device? Use Mac IP — see terminal.)"
          : err.response?.data?.detail || err.message || 'Registration failed'
      );
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
          contentContainerStyle={[styles.scrollContent, { paddingTop: 16 }]}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.lg }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.logoContainer}>
              <View style={[styles.logoCircle, { backgroundColor: ds.colors.accent }]}>
                <MaterialCommunityIcons name="account-plus" size={40} color="#FFFFFF" />
              </View>
            </View>
            
            <Text testID="register-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
              Get Started
            </Text>
            <Text testID="register-subtitle" style={[styles.subtitle, { color: ds.colors.textSecondary }]}>
              Create your Smart Pantry account
            </Text>

            <TextInput
              testID="full-name-input"
              label="Full Name (Optional)"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account-outline" />}
            />

            <TextInput
              testID="email-input"
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="email-outline" />}
            />

            <TextInput
              testID="password-input"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="lock-outline" />}
            />
            <Text style={[styles.helperText, { color: ds.colors.textTertiary }]}>
              Must be at least 8 characters
            </Text>

            <PremiumButton
              testID="register-button"
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Create Account
            </PremiumButton>

            <Button
              testID="login-link"
              mode="text"
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
              labelStyle={styles.linkButtonLabel}
            >
              Already have an account? Sign in
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={4000}
      >
        {error || ''}
      </Snackbar>
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
    padding: 20,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 24,
  },
  cardContent: {
    paddingVertical: 32,
    paddingHorizontal: 24,
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
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
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
});

