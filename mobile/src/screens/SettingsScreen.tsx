import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Text,
  Button,
  RadioButton,
  ActivityIndicator,
  Divider,
  List,
  Menu,
  Switch,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';
import { getUseCloudOcr, setUseCloudOcr } from '../services/ocrService';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { useOfflineStatus, OFFLINE_ACTION_MESSAGE } from '../hooks/useOfflineStatus';
import { getDesignSystem } from '../utils/designSystem';
import { triggerHapticSuccess } from '../utils/haptics';
import { ScreenContentWrapper } from '../components/ScreenContentWrapper';
import { PremiumButton } from '../components/PremiumButton';

interface UserSettings {
  id: number;
  user_id: number;
  ai_provider?: string;
  ai_model?: string;
  default_ai_provider?: string;
  default_ai_model?: string;
}

const AI_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-5', label: 'GPT-5 (Latest & Best)' },
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4', label: 'GPT-4 Classic' },
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Latest)' },
    { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
  ],
};

/** Fallback when API doesn't return default_ai_* (old backend). */
const DEFAULT_AI_FALLBACK = { provider: 'openai', modelLabel: 'GPT-4 Turbo' };

function getDefaultAiLabel(settings: UserSettings | null): string {
  const provider = settings?.default_ai_provider ?? DEFAULT_AI_FALLBACK.provider;
  const providerLabel = provider === 'openai' ? 'OpenAI' : 'Anthropic (Claude)';
  return `Use System Default (${providerLabel})`;
}

/** Label for "Use Provider Default" model option: show which model the server will use. */
function getDefaultModelLabel(settings: UserSettings | null): string {
  const defaultModel = settings?.default_ai_model;
  const provider = settings?.ai_provider ?? settings?.default_ai_provider ?? DEFAULT_AI_FALLBACK.provider;
  const models = provider ? AI_MODELS[provider] : undefined;
  const modelEntry = defaultModel ? models?.find((m) => m.value === defaultModel) : undefined;
  const modelLabel = modelEntry?.label ?? defaultModel ?? DEFAULT_AI_FALLBACK.modelLabel;
  return `Use Provider Default (${modelLabel})`;
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { themeMode, isDark, setThemeMode } = useTheme();
  const layout = useLayout();
  const { isOnline } = useOfflineStatus();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recoveryData, setRecoveryData] = useState<{ all_questions: Array<{ id: number; text: string }>; user_question_ids: number[] } | null>(null);
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState<Array<{ question_id: number; answer: string }>>([
    { question_id: 1, answer: '' },
    { question_id: 2, answer: '' },
  ]);
  const [savingRecovery, setSavingRecovery] = useState(false);
  const [recoveryMenuVisible, setRecoveryMenuVisible] = useState<0 | 1 | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [useCloudOcr, setUseCloudOcrState] = useState(false);
  const ds = getDesignSystem(isDark);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadRecoveryQuestions = async () => {
    try {
      const data = await apiClient.getRecoveryQuestions();
      setRecoveryData(data);
      if (data.user_question_ids.length >= 2 && data.all_questions.length >= 2) {
        const q1 = data.all_questions.find((q) => q.id === data.user_question_ids[0]) ?? data.all_questions[0];
        const q2 = data.all_questions.find((q) => q.id === data.user_question_ids[1]) ?? data.all_questions[1];
        setRecoveryForm([
          { question_id: q1.id, answer: '' },
          { question_id: q2.id, answer: '' },
        ]);
      }
    } catch {
      setRecoveryData(null);
    }
  };


  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUserSettings();
      setSettings(data);
      const recovery = await apiClient.getRecoveryQuestions().catch(() => null);
      if (recovery) setRecoveryData(recovery);
      const [available, enabled, cloudOcr] = await Promise.all([
        apiClient.isBiometricAvailable(),
        apiClient.getBiometricEnabled(),
        getUseCloudOcr(),
      ]);
      setBiometricAvailable(available);
      setBiometricEnabled(enabled);
      setUseCloudOcrState(cloudOcr);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await apiClient.updateUserSettings({
        ai_provider: settings.ai_provider || undefined,
        ai_model: settings.ai_model || undefined,
      });
      triggerHapticSuccess();
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ai_provider: provider || undefined,
      ai_model: undefined, // Reset model when provider changes
    });
  };

  const handleModelChange = (model: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ai_model: model || undefined,
    });
  };

  const handleSaveRecoveryQuestions = async () => {
    if (recoveryForm.some((r) => !r.answer.trim())) {
      Alert.alert('Missing answers', 'Please answer both questions.');
      return;
    }
    if (recoveryForm[0].question_id === recoveryForm[1].question_id) {
      Alert.alert('Different questions', 'Please choose two different questions.');
      return;
    }
    try {
      setSavingRecovery(true);
      await apiClient.setRecoveryQuestions(recoveryForm.map((r) => ({ question_id: r.question_id, answer: r.answer.trim() })));
      setShowRecoveryForm(false);
      await loadRecoveryQuestions();
      Alert.alert('Saved', 'Recovery questions updated. You can use them for easier password reset.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || err.message || 'Failed to save.');
    } finally {
      setSavingRecovery(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!isOnline) {
      Alert.alert('Offline', OFFLINE_ACTION_MESSAGE);
      return;
    }
    Alert.alert(
      '⚠️ Delete Account',
      'Are you sure you want to delete your account?\n\nThis will permanently delete:\n• All your pantries\n• All inventory items\n• All saved recipes\n• All your data\n\nThis action cannot be undone!',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              '🚨 Final Confirmation',
              'This is your last chance!\n\nYour account and all data will be permanently deleted. There is no way to recover it.\n\nAre you absolutely sure?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Yes, Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiClient.deleteAccount();
                      Alert.alert(
                        'Account Deleted',
                        'Your account has been permanently deleted. You will now be logged out.',
                        [
                          {
                            text: 'OK',
                            onPress: async () => {
                              await apiClient.logout();
                            },
                          },
                        ]
                      );
                    } catch (err: any) {
                      Alert.alert(
                        'Error',
                        err.response?.data?.detail || err.message || 'Failed to delete account. Please try again or contact support.'
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ds.colors.primary} />
          <Text style={[styles.loadingText, { color: ds.colors.textSecondary }]}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!settings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={{ color: ds.colors.textPrimary }}>Failed to load settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  const availableModels = settings.ai_provider
    ? AI_MODELS[settings.ai_provider as keyof typeof AI_MODELS] || []
    : [];

  // Get app version and build number
  // In Expo Go, Constants.manifest2 is typically available
  // In development builds, Constants.expoConfig is available
  let appVersion = 'Unknown';
  let buildNumber: string | number | undefined;
  
  // Try expoConfig first (development builds)
  if (Constants.expoConfig?.version) {
    appVersion = Constants.expoConfig.version;
    buildNumber = Constants.expoConfig.ios?.buildNumber || Constants.expoConfig.android?.versionCode;
  }
  // Try manifest2 (Expo Go and newer)
  else if (Constants.manifest2) {
    const manifest = Constants.manifest2.extra?.expoClient || Constants.manifest2.extra?.eas?.build;
    if (manifest?.version) {
      appVersion = manifest.version;
    }
    // For Expo Go, build number might not be available
    buildNumber = manifest?.ios?.buildNumber || manifest?.android?.versionCode;
  }
  // Try legacy manifest (older Expo Go)
  else if (Constants.manifest) {
    if (Constants.manifest.version) {
      appVersion = Constants.manifest.version;
    }
    buildNumber = Constants.manifest.ios?.buildNumber || Constants.manifest.android?.versionCode;
  }
  
  // Fallback to app.json values if nothing found
  if (appVersion === 'Unknown') {
    appVersion = '1.4.1';
    buildNumber = '40'; // iOS build number from app.json
  }
  
  const versionText = buildNumber 
    ? `Version ${appVersion} (${buildNumber})` 
    : `Version ${appVersion}`;
  
  // Debug logging for Expo Go
  if (__DEV__) {
    console.log('[SettingsScreen] Version info:', {
      version: appVersion,
      buildNumber,
      versionText,
      hasExpoConfig: !!Constants.expoConfig,
      hasManifest: !!Constants.manifest,
      hasManifest2: !!Constants.manifest2,
      manifest2Keys: Constants.manifest2 ? Object.keys(Constants.manifest2) : [],
      isExpoGo: Constants.executionEnvironment === 'storeClient', // Expo Go
    });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: 16 },
          layout.isTablet && { paddingHorizontal: layout.horizontalPadding, alignItems: 'center' },
        ]}
        showsVerticalScrollIndicator={true}
      >
        <ScreenContentWrapper>
        <Text testID="settings-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
          Settings
        </Text>

        {/* Sign-in: Face ID / Touch ID */}
        {biometricAvailable && (
          <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                  <MaterialCommunityIcons name="fingerprint" size={24} color={ds.colors.primary} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                    Sign-in
                  </Text>
                  <Text style={[styles.description, { color: ds.colors.textSecondary }]}>
                    Use Face ID or Touch ID to unlock the app
                  </Text>
                </View>
              </View>
              <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />
              <List.Item
                title="Use Face ID / Touch ID"
                titleNumberOfLines={2}
                description={biometricEnabled ? 'On — you will be prompted when opening the app' : 'Off — sign in with email and password'}
                descriptionNumberOfLines={3}
                left={(props) => <List.Icon {...props} icon="fingerprint" color={ds.colors.primary} />}
                right={() => (
                  <Switch
                    value={biometricEnabled}
                    onValueChange={async (value) => {
                      try {
                        await apiClient.setBiometricEnabled(value);
                        setBiometricEnabled(value);
                      } catch (err: any) {
                        Alert.alert('Error', err.message || 'Could not update setting');
                      }
                    }}
                    color={ds.colors.primary}
                  />
                )}
                titleStyle={{ color: ds.colors.textPrimary }}
                descriptionStyle={{ color: ds.colors.textSecondary }}
                style={styles.listItem}
              />
            </Card.Content>
          </Card>
        )}

        {/* Label scanning: ML Kit vs Cloud Vision */}
        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons name="camera-enhance" size={24} color={ds.colors.primary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                  Label scanning
                </Text>
                <Text style={[styles.description, { color: ds.colors.textSecondary }]}>
                  How to read text from product labels
                </Text>
              </View>
            </View>
            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />
            <List.Item
              title="Use cloud OCR (Google Vision)"
              titleNumberOfLines={2}
              description={useCloudOcr ? 'On — photos are sent to the server for OCR' : 'Off — text is read on-device (ML Kit); only text is sent'}
              descriptionNumberOfLines={3}
              left={(props) => <List.Icon {...props} icon="cloud-upload" color={ds.colors.primary} />}
              right={() => (
                <Switch
                  value={useCloudOcr}
                  onValueChange={async (value) => {
                    await setUseCloudOcr(value);
                    setUseCloudOcrState(value);
                  }}
                  color={ds.colors.primary}
                />
              )}
              titleStyle={{ color: ds.colors.textPrimary }}
              descriptionStyle={{ color: ds.colors.textSecondary }}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Appearance Settings */}
        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons 
                  name={isDark ? "weather-night" : "weather-sunny"} 
                  size={24} 
                  color={ds.colors.primary} 
                />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                  Appearance
                </Text>
                <Text style={[styles.description, { color: ds.colors.textSecondary }]}>
                  Choose your preferred theme
                </Text>
              </View>
            </View>

            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />

            <View style={styles.themeSelector}>
              <TouchableOpacity
                testID="theme-light"
                onPress={() => setThemeMode('light')}
                style={[
                  styles.themeOption,
                  { 
                    backgroundColor: themeMode === 'light' ? ds.colors.primary : ds.colors.surfaceHover,
                    borderColor: themeMode === 'light' ? ds.colors.primary : 'transparent',
                  }
                ]}
                accessibilityLabel="Light theme"
                accessibilityHint="Double tap to use light theme"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons 
                  name="weather-sunny" 
                  size={24} 
                  color={themeMode === 'light' ? '#FFFFFF' : ds.colors.textSecondary} 
                />
                <Text style={{ 
                  color: themeMode === 'light' ? '#FFFFFF' : ds.colors.textPrimary,
                  fontSize: 13,
                  fontWeight: '600',
                  marginTop: 8,
                }}>
                  Light
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                testID="theme-system"
                onPress={() => setThemeMode('system')}
                style={[
                  styles.themeOption,
                  { 
                    backgroundColor: themeMode === 'system' ? ds.colors.primary : ds.colors.surfaceHover,
                    borderColor: themeMode === 'system' ? ds.colors.primary : 'transparent',
                  }
                ]}
                accessibilityLabel="System theme"
                accessibilityHint="Double tap to use system theme"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons 
                  name="cellphone" 
                  size={24} 
                  color={themeMode === 'system' ? '#FFFFFF' : ds.colors.textSecondary} 
                />
                <Text style={{ 
                  color: themeMode === 'system' ? '#FFFFFF' : ds.colors.textPrimary,
                  fontSize: 13,
                  fontWeight: '600',
                  marginTop: 8,
                }}>
                  System
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                testID="theme-dark"
                onPress={() => setThemeMode('dark')}
                style={[
                  styles.themeOption,
                  { 
                    backgroundColor: themeMode === 'dark' ? ds.colors.primary : ds.colors.surfaceHover,
                    borderColor: themeMode === 'dark' ? ds.colors.primary : 'transparent',
                  }
                ]}
                accessibilityLabel="Dark theme"
                accessibilityHint="Double tap to use dark theme"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons 
                  name="weather-night" 
                  size={24} 
                  color={themeMode === 'dark' ? '#FFFFFF' : ds.colors.textSecondary} 
                />
                <Text style={{ 
                  color: themeMode === 'dark' ? '#FFFFFF' : ds.colors.textPrimary,
                  fontSize: 13,
                  fontWeight: '600',
                  marginTop: 8,
                }}>
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons 
                  name="robot" 
                  size={24} 
                  color={ds.colors.primary} 
                />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                  AI Model Preferences
                </Text>
                <Text style={[styles.description, { color: ds.colors.textSecondary }]}>
                  Choose your AI for recipe generation
                </Text>
              </View>
            </View>

            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />

            <Text style={[styles.label, { color: ds.colors.textPrimary }]}>
              AI Provider
            </Text>
            <RadioButton.Group
              onValueChange={handleProviderChange}
              value={settings.ai_provider || ''}
            >
              <RadioButton.Item
                testID="ai-provider-default"
                label={getDefaultAiLabel(settings)}
                value=""
                labelStyle={[styles.radioLabel, { color: ds.colors.textPrimary }]}
                color={ds.colors.primary}
                uncheckedColor={isDark ? '#FFFFFF' : ds.colors.textSecondary}
              />
              <RadioButton.Item 
                testID="ai-provider-openai" 
                label="OpenAI" 
                value="openai" 
                labelStyle={[styles.radioLabel, { color: ds.colors.textPrimary }]}
                color={ds.colors.primary}
                uncheckedColor={isDark ? '#FFFFFF' : ds.colors.textSecondary}
              />
              <RadioButton.Item 
                testID="ai-provider-anthropic" 
                label="Anthropic (Claude)" 
                value="anthropic" 
                labelStyle={[styles.radioLabel, { color: ds.colors.textPrimary }]}
                color={ds.colors.primary}
                uncheckedColor={isDark ? '#FFFFFF' : ds.colors.textSecondary}
              />
            </RadioButton.Group>

            {settings.ai_provider && (
              <>
                <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />
                <Text style={[styles.label, { color: ds.colors.textPrimary }]}>
                  AI Model
                </Text>
                <RadioButton.Group
                  onValueChange={handleModelChange}
                  value={settings.ai_model || ''}
                >
                  <RadioButton.Item
                    testID="ai-model-default"
                    label={getDefaultModelLabel(settings)}
                    value=""
                    labelStyle={[styles.radioLabel, { color: ds.colors.textPrimary }]}
                    color={ds.colors.primary}
                    uncheckedColor={isDark ? '#FFFFFF' : ds.colors.textSecondary}
                  />
                  {availableModels.map((model) => (
                    <RadioButton.Item
                      key={model.value}
                      testID={`ai-model-${model.value}`}
                      label={model.label}
                      value={model.value}
                      labelStyle={[styles.radioLabel, { color: ds.colors.textPrimary }]}
                      color={ds.colors.primary}
                      uncheckedColor={isDark ? '#FFFFFF' : ds.colors.textSecondary}
                    />
                  ))}
                </RadioButton.Group>
              </>
            )}

            <PremiumButton
              testID="save-settings-button"
              mode="contained"
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButton}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </PremiumButton>
          </Card.Content>
        </Card>

        {/* Recovery questions */}
        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons name="help-circle-outline" size={24} color={ds.colors.primary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                  Recovery questions
                </Text>
                <Text style={[styles.description, { color: ds.colors.textSecondary }]}>
                  Easier password reset without the Authenticator app. Set 2 questions.
                </Text>
              </View>
            </View>
            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />
            {recoveryData && (
              <>
                <Text style={[styles.description, { color: ds.colors.textSecondary, marginBottom: 12 }]}>
                  {recoveryData.user_question_ids.length >= 2 ? '2 questions set. You can use them on Forgot password.' : 'Not set. Tap below to set 2 questions.'}
                </Text>
                {!showRecoveryForm ? (
                  <Button
                    mode="outlined"
                    onPress={() => {
                      if (recoveryData.user_question_ids.length >= 2) {
                        const q1 = recoveryData.all_questions.find((q) => q.id === recoveryData.user_question_ids[0]) ?? recoveryData.all_questions[0];
                        const q2 = recoveryData.all_questions.find((q) => q.id === recoveryData.user_question_ids[1]) ?? recoveryData.all_questions[1];
                        setRecoveryForm([{ question_id: q1.id, answer: '' }, { question_id: q2.id, answer: '' }]);
                      }
                      setShowRecoveryForm(true);
                    }}
                    style={styles.saveButton}
                    accessibilityLabel={recoveryData.user_question_ids.length >= 2 ? 'Update recovery questions' : 'Set recovery questions'}
                    accessibilityHint={recoveryData.user_question_ids.length >= 2 ? 'Double tap to update your recovery questions' : 'Double tap to set recovery questions for password reset'}
                    accessibilityRole="button"
                  >
                    {recoveryData.user_question_ids.length >= 2 ? 'Update recovery questions' : 'Set recovery questions'}
                  </Button>
                ) : (
                  <>
                    {[0, 1].map((idx) => (
                      <View key={idx} style={{ marginBottom: 16 }}>
                        <Text style={[styles.description, { color: ds.colors.textSecondary, marginBottom: 4 }]}>
                          Question {idx + 1}
                        </Text>
                        <Menu
                          visible={recoveryMenuVisible === idx}
                          onDismiss={() => setRecoveryMenuVisible(null)}
                          anchor={
                            <Button mode="outlined" onPress={() => setRecoveryMenuVisible(idx)} style={{ marginBottom: 6 }} accessibilityLabel={`Question ${idx + 1}: ${recoveryData.all_questions.find((q) => q.id === recoveryForm[idx].question_id)?.text ?? 'Pick question'}`} accessibilityHint="Double tap to choose a security question" accessibilityRole="button">
                              {recoveryData.all_questions.find((q) => q.id === recoveryForm[idx].question_id)?.text ?? 'Pick question'}
                            </Button>
                          }
                        >
                          {recoveryData.all_questions.map((q) => (
                            <Menu.Item
                              key={q.id}
                              onPress={() => {
                                setRecoveryForm((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], question_id: q.id };
                                  return next;
                                });
                                setRecoveryMenuVisible(null);
                              }}
                              title={q.text}
                              titleStyle={{ color: ds.colors.textPrimary }}
                              accessibilityRole="button"
                              accessibilityLabel={q.text}
                              accessibilityHint="Double tap to select this question"
                            />
                          ))}
                        </Menu>
                        <TextInput
                          label="Your answer"
                          value={recoveryForm[idx].answer}
                          onChangeText={(text) =>
                            setRecoveryForm((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], answer: text };
                              return next;
                            })
                          }
                          mode="outlined"
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={styles.input}
                          accessibilityLabel="Your answer"
                          accessibilityHint="Double tap to enter your answer for this security question"
                        />
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Button mode="outlined" onPress={() => setShowRecoveryForm(false)} style={{ flex: 1 }}>
                        Cancel
                      </Button>
                      <PremiumButton mode="contained" onPress={handleSaveRecoveryQuestions} loading={savingRecovery} disabled={savingRecovery} style={{ flex: 1 }}>
                        Save
                      </PremiumButton>
                    </View>
                  </>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        {/* Account Management Section */}
        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: isDark ? '#4a1a1a' : '#fee' }]}>
                <MaterialCommunityIcons 
                  name="account-remove" 
                  size={24} 
                  color={isDark ? '#ff6b6b' : '#dc2626'} 
                />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                  Account Management
                </Text>
                <Text style={[styles.description, { color: ds.colors.textSecondary }]}>
                  Manage or delete your account
                </Text>
              </View>
            </View>

            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />

            <View style={styles.dangerZone}>
              <MaterialCommunityIcons 
                name="alert-circle" 
                size={20} 
                color={isDark ? '#ff6b6b' : '#dc2626'} 
                style={styles.dangerIcon}
              />
              <View style={styles.dangerTextContainer}>
                <Text style={[styles.dangerTitle, { color: isDark ? '#ff6b6b' : '#dc2626' }]}>
                  Danger Zone
                </Text>
                <Text style={[styles.dangerDescription, { color: ds.colors.textSecondary }]}>
                  Once you delete your account, there is no going back. This will permanently delete all your pantries, inventory, and recipes.
                </Text>
              </View>
            </View>

            <Button
              mode="outlined"
              onPress={handleDeleteAccount}
              textColor={isDark ? '#ff6b6b' : '#dc2626'}
              style={[
                styles.deleteButton,
                { 
                  borderColor: isDark ? '#ff6b6b' : '#dc2626',
                  borderWidth: 1.5,
                }
              ]}
              icon="delete-forever"
            >
              Delete My Account
            </Button>
          </Card.Content>
        </Card>

        {/* Legal & About Section */}
        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: ds.colors.surfaceHover }]}>
                <MaterialCommunityIcons 
                  name="shield-check" 
                  size={24} 
                  color={ds.colors.primary} 
                />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: ds.colors.textPrimary }]}>
                  Legal & About
                </Text>
                <Text style={[styles.description, { color: ds.colors.textSecondary }]}>
                  Privacy, terms, and app information
                </Text>
              </View>
            </View>

            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />

            <List.Item
              title="Privacy Policy"
              titleNumberOfLines={2}
              description="How we handle your data"
              descriptionNumberOfLines={2}
              left={(props) => <List.Icon {...props} icon="shield-lock" color={ds.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={ds.colors.textTertiary} />}
              onPress={() => navigation.navigate('Legal' as never, { type: 'privacy' } as never)}
              titleStyle={{ color: ds.colors.textPrimary, fontSize: 15, fontWeight: '500' }}
              descriptionStyle={{ color: ds.colors.textSecondary, fontSize: 13 }}
              style={styles.listItem}
              accessibilityLabel="Privacy Policy"
              accessibilityHint="Double tap to read privacy policy"
            />

            <List.Item
              title="Terms of Service"
              titleNumberOfLines={2}
              description="Usage terms and conditions"
              descriptionNumberOfLines={2}
              left={(props) => <List.Icon {...props} icon="file-document" color={ds.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={ds.colors.textTertiary} />}
              onPress={() => navigation.navigate('Legal' as never, { type: 'terms' } as never)}
              titleStyle={{ color: ds.colors.textPrimary, fontSize: 15, fontWeight: '500' }}
              descriptionStyle={{ color: ds.colors.textSecondary, fontSize: 13 }}
              style={styles.listItem}
              accessibilityLabel="Terms of Service"
              accessibilityHint="Double tap to read terms of service"
            />

            <List.Item
              title="Support"
              titleNumberOfLines={2}
              description="Contact us for help"
              descriptionNumberOfLines={2}
              left={(props) => <List.Icon {...props} icon="help-circle" color={ds.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="open-in-new" color={ds.colors.textTertiary} />}
              onPress={() => {
                const url = Constants.expoConfig?.extra?.supportUrl as string | undefined;
                Linking.openURL(url || 'https://smartpantry.app/support').catch(() => {});
              }}
              titleStyle={{ color: ds.colors.textPrimary, fontSize: 15, fontWeight: '500' }}
              descriptionStyle={{ color: ds.colors.textSecondary, fontSize: 13 }}
              style={styles.listItem}
              accessibilityLabel="Support"
              accessibilityHint="Double tap to open support in browser"
            />

            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />

            <View style={styles.copyrightContainer}>
              <Text style={[styles.copyrightText, { color: ds.colors.textTertiary }]}>
                © 2026 Smart Pantry AI{'\n'}All rights reserved
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* App Version Info */}
        <View style={styles.versionContainer}>
          <Text 
            testID="app-version"
            style={[
              styles.versionText, 
              { color: ds.colors.textSecondary }
            ]}
          >
            {versionText}
          </Text>
        </View>
        </ScreenContentWrapper>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
  },
  cardContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    marginVertical: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  radioLabel: {
    fontSize: 15,
  },
  input: {
    marginBottom: 8,
  },
  saveButton: {
    marginTop: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  listItem: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  versionContainer: {
    paddingVertical: 24,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    marginTop: 8,
  },
  versionText: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 13,
    fontWeight: '400',
  },
  copyrightContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  copyrightText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  dangerZone: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    marginBottom: 16,
  },
  dangerIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  dangerTextContainer: {
    flex: 1,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  dangerDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteButton: {
    marginTop: 8,
  },
});

