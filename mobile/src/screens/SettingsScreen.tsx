import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Text,
  Button,
  RadioButton,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import apiClient from '../api/client';

interface UserSettings {
  id: number;
  user_id: number;
  ai_provider?: string;
  ai_model?: string;
}

const AI_MODELS = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommended)' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
  ],
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 16 }}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!settings) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text>Failed to load settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  const availableModels = settings.ai_provider
    ? AI_MODELS[settings.ai_provider as keyof typeof AI_MODELS] || []
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
        <Text variant="headlineSmall" style={styles.title}>
          Settings
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              AI Model Preferences
            </Text>
            <Text variant="bodySmall" style={styles.description}>
              Choose which AI model to use for recipe generation. Claude 3.5 Sonnet is recommended for creative recipes, while GPT-4o offers a good balance of quality and speed.
            </Text>

            <Divider style={styles.divider} />

            <Text variant="bodyMedium" style={styles.label}>
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
                <Divider style={styles.divider} />
                <Text variant="bodyMedium" style={styles.label}>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  description: {
    marginBottom: 16,
    color: '#6b7280',
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
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

