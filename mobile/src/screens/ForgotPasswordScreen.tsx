import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import { PremiumButton } from '../components/PremiumButton';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';

type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const navigation = useNavigation<NavigationProp>();

  const handleSubmit = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await apiClient.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      const isNetwork =
        err.code === 'ERR_NETWORK' ||
        err.message?.includes('Network Error') ||
        err.message?.includes('timeout');
      
      if (isNetwork) {
        setError("Can't reach server. Please check your connection.");
      } else {
        // Show generic message for security (don't reveal if email exists)
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.lg }]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)' }]}>
                  <MaterialCommunityIcons name="email-check-outline" size={48} color="#22c55e" />
                </View>
              </View>
              
              <Text style={[styles.title, { color: ds.colors.textPrimary }]}>
                Check Your Email
              </Text>
              
              <Text style={[styles.message, { color: ds.colors.textSecondary }]}>
                If an account exists with that email, we've sent password reset instructions to:
              </Text>
              
              <Text style={[styles.emailText, { color: ds.colors.textPrimary }]}>
                {email}
              </Text>
              
              <Text style={[styles.subtitle, { color: ds.colors.textSecondary }]}>
                The link will expire in 1 hour. If you don't see the email, check your spam folder.
              </Text>

              <PremiumButton
                mode="contained"
                onPress={() => navigation.navigate('Login')}
                style={styles.button}
              >
                Back to Sign In
              </PremiumButton>
              
              <Button
                mode="text"
                onPress={() => {
                  setSuccess(false);
                  setEmail('');
                }}
                style={styles.linkButton}
                labelStyle={styles.linkButtonLabel}
              >
                Try another email
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.lg }]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
                  <MaterialCommunityIcons name="lock-reset" size={48} color="#3b82f6" />
                </View>
              </View>
              
              <Text style={[styles.title, { color: ds.colors.textPrimary }]}>
                Forgot Password?
              </Text>
              
              <Text style={[styles.subtitle, { color: ds.colors.textSecondary }]}>
                Enter your email address and we'll send you a link to reset your password.
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
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="email-outline" />}
              />

              <PremiumButton
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Send Reset Link
              </PremiumButton>

              <Button
                mode="text"
                onPress={() => navigation.goBack()}
                style={styles.linkButton}
                labelStyle={styles.linkButtonLabel}
              >
                Back to Sign In
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    marginBottom: 24,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
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
