import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Text,
  Button,
  RadioButton,
  ActivityIndicator,
  Divider,
  List,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import apiClient from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import { PremiumButton } from '../components/PremiumButton';

interface UserSettings {
  id: number;
  user_id: number;
  ai_provider?: string;
  ai_model?: string;
}

const AI_MODELS = {
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

export default function SettingsScreen() {
  const { themeMode, isDark, setThemeMode } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const ds = getDesignSystem(isDark);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUserSettings();
      setSettings(data);
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
    appVersion = '1.4.0';
    buildNumber = '39'; // iOS build number from app.json
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
        contentContainerStyle={[styles.content, { paddingTop: 16, paddingBottom: 16 }]}
        showsVerticalScrollIndicator={true}
      >
        <Text testID="settings-title" style={[styles.title, { color: ds.colors.textPrimary }]}>
          Settings
        </Text>

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
                label="Use System Default" 
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
                    label="Use Provider Default" 
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
});

