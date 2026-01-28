import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import { PremiumButton } from '../components/PremiumButton';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';

type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Step = 'email' | 'totp';

type ResetPath = 'totp' | 'recovery' | null;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [qrImageBase64, setQrImageBase64] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [hasExistingTotp, setHasExistingTotp] = useState(false);
  const [recoveryQuestions, setRecoveryQuestions] = useState<Array<{ id: number; text: string }> | null>(null);
  const [resetPath, setResetPath] = useState<ResetPath>(null);
  const [recoveryAnswers, setRecoveryAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const navigation = useNavigation<NavigationProp>();

  const hasTotpPath = (): boolean =>
    Boolean(hasExistingTotp || totpUri || qrImageBase64);
  const hasRecoveryPath = (): boolean =>
    Boolean(recoveryQuestions && recoveryQuestions.length >= 2);

  const handleSubmitEmail = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.forgotPassword(email);
      const canProceed =
        res.has_existing_totp ||
        res.totp_uri ||
        res.qr_image_base64 ||
        (res.has_recovery_questions && res.recovery_questions && res.recovery_questions.length >= 2);
      if (canProceed) {
        setHasExistingTotp(res.has_existing_totp ?? false);
        setQrImageBase64(res.qr_image_base64 ?? null);
        setTotpUri(res.totp_uri ?? null);
        setRecoveryQuestions(res.recovery_questions ?? null);
        const totpOk = res.has_existing_totp || res.totp_uri || res.qr_image_base64;
        const recoveryOk = res.has_recovery_questions && res.recovery_questions && res.recovery_questions.length >= 2;
        setResetPath(recoveryOk && !totpOk ? 'recovery' : totpOk && !recoveryOk ? 'totp' : null);
        setStep('totp');
      } else {
        setError("If an account exists with that email, you'll need to set up the Authenticator app or recovery questions. Try again.");
      }
    } catch (err: any) {
      const isNetwork = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('timeout');
      setError(isNetwork ? "Can't reach server. Check your connection." : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecovery = async () => {
    if (!recoveryQuestions || recoveryQuestions.length < 2) return;
    const answers = recoveryQuestions.map((q) => ({
      question_id: q.id,
      answer: (recoveryAnswers[q.id] ?? '').trim(),
    }));
    if (answers.some((a) => !a.answer)) {
      setError('Please answer all questions.');
      return;
    }
    setError(null);
    setVerifyLoading(true);
    try {
      const { reset_token } = await apiClient.verifyResetRecovery(email, answers);
      navigation.navigate('ResetPassword', { token: reset_token });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Incorrect answers. Try again or use the Authenticator app.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmed = code.replace(/\s/g, '');
    if (trimmed.length !== 6 || !/^\d+$/.test(trimmed)) {
      setError('Enter the 6-digit code from your Authenticator app.');
      return;
    }
    setError(null);
    setVerifyLoading(true);
    try {
      const { reset_token } = await apiClient.verifyResetTotp(email, trimmed);
      navigation.navigate('ResetPassword', { token: reset_token });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired code. Request a new password reset and try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (step === 'totp') {
    const showChoice = resetPath === null && hasTotpPath() && hasRecoveryPath();
    const showRecoveryForm = resetPath === 'recovery' && recoveryQuestions && recoveryQuestions.length >= 2;
    const showTotpForm = resetPath === 'totp' || (resetPath === null && hasTotpPath());

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                {showChoice ? (
                  <>
                    <View style={styles.iconContainer}>
                      <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
                        <MaterialCommunityIcons name="lock-reset" size={48} color="#3b82f6" />
                      </View>
                    </View>
                    <Text style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
                      How do you want to reset?
                    </Text>
                    <Text style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
                      Choose the Authenticator app (more secure) or answer your recovery questions (easier).
                    </Text>
                    <PremiumButton
                      mode="outlined"
                      onPress={() => setResetPath('totp')}
                      style={styles.button}
                      icon="cellphone-key"
                    >
                      Use Authenticator app
                    </PremiumButton>
                    <PremiumButton
                      mode="outlined"
                      onPress={() => setResetPath('recovery')}
                      style={styles.button}
                      icon="help-circle-outline"
                    >
                      Answer my recovery questions
                    </PremiumButton>
                    <Button mode="text" onPress={() => { setStep('email'); setCode(''); setError(null); setResetPath(null); }} style={styles.linkButton} labelStyle={styles.linkButtonLabel}>
                      Use a different email
                    </Button>
                  </>
                ) : showRecoveryForm ? (
                  <>
                    <View style={styles.iconContainer}>
                      <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
                        <MaterialCommunityIcons name="help-circle-outline" size={48} color="#3b82f6" />
                      </View>
                    </View>
                    <Text style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
                      Answer your recovery questions
                    </Text>
                    <Text style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
                      Answer the questions you set when you created your account. Answers are not case-sensitive.
                    </Text>
                    {recoveryQuestions!.map((q) => (
                      <View key={q.id} style={styles.recoveryQuestionBlock}>
                        <Text style={[styles.recoveryQuestionLabel, { color: ds.colors.textSecondary }]}>{q.text}</Text>
                        <TextInput
                          value={recoveryAnswers[q.id] ?? ''}
                          onChangeText={(text) => {
                            setRecoveryAnswers((prev) => ({ ...prev, [q.id]: text }));
                            if (error) setError(null);
                          }}
                          mode="outlined"
                          style={styles.input}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    ))}
                    {error ? (
                      <View style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' }]}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ef4444" />
                        <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
                      </View>
                    ) : null}
                    <PremiumButton mode="contained" onPress={handleVerifyRecovery} loading={verifyLoading} disabled={verifyLoading} style={styles.button}>
                      Verify & Continue
                    </PremiumButton>
                    <Button mode="text" onPress={() => setResetPath(null)} style={styles.linkButton} labelStyle={styles.linkButtonLabel}>
                      Back
                    </Button>
                    <Button mode="text" onPress={() => { setStep('email'); setError(null); setResetPath(null); }} style={styles.linkButton} labelStyle={styles.linkButtonLabel}>
                      Use a different email
                    </Button>
                  </>
                ) : (
                  <>
                <View style={styles.iconContainer}>
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
                    <MaterialCommunityIcons name="cellphone-key" size={48} color="#3b82f6" />
                  </View>
                </View>
                <Text style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
                  Authenticator Code
                </Text>
                <Text style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
                  {hasExistingTotp
                    ? 'Enter the 6-digit code from your Authenticator app.'
                    : 'Add Smart Pantry to your Authenticator app using the QR code or the button below, then enter the 6-digit code.'}
                </Text>
                {qrImageBase64 ? (
                  <View style={styles.qrContainer}>
                    <Image
                      source={{ uri: `data:image/png;base64,${qrImageBase64}` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}
                {totpUri && !hasExistingTotp ? (
                  <View style={styles.openAuthenticatorBlock}>
                    <Button
                      mode="outlined"
                      onPress={() => Linking.openURL(totpUri)}
                      style={styles.openAuthenticatorButton}
                      icon="cellphone-key"
                    >
                      Open in Authenticator app (same device)
                    </Button>
                    <Text style={[styles.hintText, { color: ds.colors.textSecondary }]}>
                      In the app that opens (e.g. 1Password or Google Authenticator), save or add the Smart Pantry entry. Then return here and enter the 6-digit code below.
                    </Text>
                  </View>
                ) : null}
                {hasExistingTotp ? (
                  <Button
                    mode="text"
                    onPress={async () => {
                      setError(null);
                      setVerifyLoading(true);
                      try {
                        const res = await apiClient.forgotPassword(email, true);
                        setQrImageBase64(res.qr_image_base64 ?? null);
                        setTotpUri(res.totp_uri ?? null);
                        setHasExistingTotp(false);
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : 'Failed to show QR again.');
                      } finally {
                        setVerifyLoading(false);
                      }
                    }}
                    disabled={verifyLoading}
                    style={styles.linkButton}
                    labelStyle={styles.linkButtonLabel}
                  >
                    Show QR code again (e.g. new device)
                  </Button>
                ) : null}
                {error ? (
                  <View style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' }]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ef4444" />
                    <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
                  </View>
                ) : null}
                <TextInput
                  label="6-digit code"
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.replace(/\D/g, '').slice(0, 6));
                    if (error) setError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="numeric" />}
                />
                <PremiumButton
                  mode="contained"
                  onPress={handleVerifyCode}
                  loading={verifyLoading}
                  disabled={verifyLoading}
                  style={styles.button}
                >
                  Verify & Continue
                </PremiumButton>
                {resetPath === 'totp' && hasRecoveryPath() ? (
                  <Button mode="text" onPress={() => setResetPath(null)} style={styles.linkButton} labelStyle={styles.linkButtonLabel}>
                    Back
                  </Button>
                ) : null}
                <Button mode="text" onPress={() => { setStep('email'); setCode(''); setError(null); setResetPath(null); }} style={styles.linkButton} labelStyle={styles.linkButtonLabel}>
                  Use a different email
                </Button>
                  </>
                )}
              </Card.Content>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
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
                Forgot Password?
              </Text>
              
              <Text style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
                Enter your email. You'll verify with your Authenticator app (or set it up with a QR code), then set a new password.
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
                onPress={handleSubmitEmail}
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Continue
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
  qrContainer: {
    alignItems: 'center',
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  openAuthenticatorBlock: {
    marginBottom: 16,
  },
  openAuthenticatorButton: {
    marginBottom: 8,
  },
  recoveryQuestionBlock: {
    marginBottom: 16,
  },
  recoveryQuestionLabel: {
    fontSize: 14,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
