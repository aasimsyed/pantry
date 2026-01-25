import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, Switch } from 'react-native';
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
import apiClient from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem, getTextStyle } from '../utils/designSystem';

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
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ds.colors.primary} />
          <Text style={[styles.loadingText, getTextStyle('body', ds.colors.textSecondary, isDark)]}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!settings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={getTextStyle('body', ds.colors.textPrimary, isDark)}>Failed to load settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  const availableModels = settings.ai_provider
    ? AI_MODELS[settings.ai_provider as keyof typeof AI_MODELS] || []
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
        <Text style={[styles.title, getTextStyle('headline', ds.colors.textPrimary, isDark)]}>
          Settings
        </Text>

        {/* Appearance Settings */}
        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, getTextStyle('title', ds.colors.textPrimary, isDark)]}>
              Appearance
            </Text>
            <Text style={[styles.description, getTextStyle('body', ds.colors.textSecondary, isDark)]}>
              Choose your preferred theme. System will follow your device settings.
            </Text>

            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />

            <List.Item
              title="Theme"
              description={
                themeMode === 'system' 
                  ? 'Follow system' 
                  : themeMode === 'dark' 
                  ? 'Dark mode' 
                  : 'Light mode'
              }
              left={(props) => (
                <MaterialCommunityIcons 
                  name={isDark ? "weather-night" : "weather-sunny"} 
                  size={24} 
                  color={ds.colors.primary} 
                  style={{ marginTop: 8 }}
                />
              )}
              right={() => (
                <View style={styles.themeSelector}>
                  <Button
                    mode={themeMode === 'light' ? 'contained' : 'outlined'}
                    onPress={() => setThemeMode('light')}
                    compact
                    style={styles.themeButton}
                    labelStyle={styles.themeButtonLabel}
                  >
                    Light
                  </Button>
                  <Button
                    mode={themeMode === 'system' ? 'contained' : 'outlined'}
                    onPress={() => setThemeMode('system')}
                    compact
                    style={styles.themeButton}
                    labelStyle={styles.themeButtonLabel}
                  >
                    System
                  </Button>
                  <Button
                    mode={themeMode === 'dark' ? 'contained' : 'outlined'}
                    onPress={() => setThemeMode('dark')}
                    compact
                    style={styles.themeButton}
                    labelStyle={styles.themeButtonLabel}
                  >
                    Dark
                  </Button>
                </View>
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, getTextStyle('title', ds.colors.textPrimary, isDark)]}>
              AI Model Preferences
            </Text>
            <Text style={[styles.description, getTextStyle('body', ds.colors.textSecondary, isDark)]}>
              Choose which AI model to use for recipe generation. GPT-5 offers the best quality and reasoning, GPT-4o provides excellent balance, while Claude models excel at creative recipes.
            </Text>

            <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />

            <Text style={[styles.label, getTextStyle('body', ds.colors.textPrimary, isDark)]}>
              AI Provider
            </Text>
            <RadioButton.Group
              onValueChange={handleProviderChange}
              value={settings.ai_provider || ''}
            >
              <RadioButton.Item label="Use System Default" value="" />
              <RadioButton.Item label="OpenAI" value="openai" />
              <RadioButton.Item label="Anthropic (Claude)" value="anthropic" />
            </RadioButton.Group>

            {settings.ai_provider && (
              <>
                <Divider style={[styles.divider, { backgroundColor: ds.colors.surfaceHover }]} />
                <Text style={[styles.label, getTextStyle('body', ds.colors.textPrimary, isDark)]}>
                  AI Model
                </Text>
                <RadioButton.Group
                  onValueChange={handleModelChange}
                  value={settings.ai_model || ''}
                >
                  <RadioButton.Item label="Use Provider Default" value="" />
                  {availableModels.map((model) => (
                    <RadioButton.Item
                      key={model.value}
                      label={model.label}
                      value={model.value}
                    />
                  ))}
                </RadioButton.Group>
              </>
            )}

            <Button
              mode="contained"
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButton}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
    fontWeight: '700',
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  description: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 12,
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
    gap: 8,
    alignItems: 'center',
  },
  themeButton: {
    borderRadius: 8,
  },
  themeButtonLabel: {
    fontSize: 12,
  },
});

