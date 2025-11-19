import { useState, useEffect } from 'react';
import { Card, Button, Select, MenuItem, FormControl, InputLabel, Typography, Box, Alert } from '@mui/material';
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
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Latest)' },
    { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
  ],
};

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUserSettings();
      setSettings(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setMessage(null);
      await apiClient.updateUserSettings({
        ai_provider: settings.ai_provider || undefined,
        ai_model: settings.ai_model || undefined,
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
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
      <Box sx={{ p: 3 }}>
        <Typography>Loading settings...</Typography>
      </Box>
    );
  }

  if (!settings) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load settings</Alert>
      </Box>
    );
  }

  const availableModels = settings.ai_provider ? AI_MODELS[settings.ai_provider as keyof typeof AI_MODELS] || [] : [];

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Card sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          AI Model Preferences
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Choose which AI model to use for recipe generation. Claude 3.5 Sonnet is recommended for creative recipes, while GPT-4o offers a good balance of quality and speed.
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>AI Provider</InputLabel>
          <Select
            value={settings.ai_provider || ''}
            label="AI Provider"
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <MenuItem value="">Use System Default</MenuItem>
            <MenuItem value="openai">OpenAI</MenuItem>
            <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
          </Select>
        </FormControl>

        {settings.ai_provider && (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>AI Model</InputLabel>
            <Select
              value={settings.ai_model || ''}
              label="AI Model"
              onChange={(e) => handleModelChange(e.target.value)}
            >
              <MenuItem value="">Use Provider Default</MenuItem>
              {availableModels.map((model) => (
                <MenuItem key={model.value} value={model.value}>
                  {model.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ mt: 2 }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Card>
    </Box>
  );
}

