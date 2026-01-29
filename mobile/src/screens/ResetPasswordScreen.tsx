import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import { PremiumButton } from '../components/PremiumButton';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';

type RootStackParamList = {
  Login: undefined;
  ResetPassword: { token: string };
};

type ResetPasswordRouteProp = RouteProp<RootStackParamList, 'ResetPassword'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResetPasswordRouteProp>();
  
  const token = route.params?.token;

  useEffect(() => {
    // Validate token exists
    if (!token) {
      setTokenValid(false);
      setError('Invalid password reset link');
    } else {
      setTokenValid(true);
    }
  }, [token]);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await apiClient.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || err.message;
      
      if (errorDetail?.toLowerCase().includes('expired') || 
          errorDetail?.toLowerCase().includes('invalid')) {
        setError('This password reset link has expired or is invalid. Please request a new one.');
      } else if (errorDetail?.toLowerCase().includes('password')) {
        setError(errorDetail);
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === false) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: layout.horizontalPadding },
            layout.isTablet && { alignItems: 'center' },
          ]}
        >
          <Card style={[styles.card, layout.isTablet && styles.cardTablet, { backgroundColor: ds.colors.surface, ...ds.shadows.lg }]}>
            <Card.Content style={[styles.cardContent, layout.isTablet && styles.cardContentTablet]}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
                </View>
              </View>
              
              <Text style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
                Invalid Link
              </Text>
              
              <Text style={[styles.message, { color: ds.colors.textSecondary }]}>
                This password reset link is invalid or has expired.
              </Text>

              <PremiumButton
                mode="contained"
                onPress={() => navigation.navigate('Login')}
                style={styles.button}
              >
                Back to Sign In
              </PremiumButton>
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: layout.horizontalPadding },
            layout.isTablet && { alignItems: 'center' },
          ]}
        >
          <Card style={[styles.card, layout.isTablet && styles.cardTablet, { backgroundColor: ds.colors.surface, ...ds.shadows.lg }]}>
            <Card.Content style={[styles.cardContent, layout.isTablet && styles.cardContentTablet]}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)' }]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={48} color="#22c55e" />
                </View>
              </View>
              
              <Text style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
                Password Reset!
              </Text>
              
              <Text style={[styles.message, { color: ds.colors.textSecondary }]}>
                Your password has been successfully reset. You can now sign in with your new password.
              </Text>

              <PremiumButton
                mode="contained"
                onPress={() => navigation.popToTop()}
                style={styles.button}
              >
                Sign In
              </PremiumButton>
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: layout.horizontalPadding },
            layout.isTablet && { alignItems: 'center' },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={[styles.card, layout.isTablet && styles.cardTablet, { backgroundColor: ds.colors.surface, ...ds.shadows.lg }]}>
            <Card.Content style={[styles.cardContent, layout.isTablet && styles.cardContentTablet]}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
                  <MaterialCommunityIcons name="lock-reset" size={48} color="#3b82f6" />
                </View>
              </View>
              
              <Text style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
                Reset Your Password
              </Text>
              
              <Text style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
                Enter your new password below
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
                label="New Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                autoFocus
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="lock-outline" />}
                accessibilityLabel="New password"
                accessibilityRole="none"
              />

              <TextInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (error) setError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                mode="outlined"
                style={styles.input}
                accessibilityLabel="Confirm password"
                accessibilityRole="none"
                left={<TextInput.Icon icon="lock-check-outline" />}
              />

              <PremiumButton
                mode="contained"
                onPress={handleSubmit}
                accessibilityLabel="Reset password"
                accessibilityRole="button"
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Reset Password
              </PremiumButton>

              <Button
                mode="text"
                onPress={() => navigation.navigate('Login')}
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
  titleTablet: {
    fontSize: 32,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  subtitleTablet: {
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 28,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
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
