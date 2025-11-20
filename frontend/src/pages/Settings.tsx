import { useState, useEffect } from 'react';
import apiClient from '../api/client';

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
      <div className="p-6">
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Failed to load settings
        </div>
      </div>
    );
  }

  const availableModels = settings.ai_provider ? AI_MODELS[settings.ai_provider as keyof typeof AI_MODELS] || [] : [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex justify-between items-center">
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">AI Model Preferences</h2>
        <p className="text-gray-600 mb-6">
          Choose which AI model to use for recipe generation. GPT-5 offers the best quality and reasoning, GPT-4o provides excellent balance, while Claude models excel at creative recipes.
        </p>

        <div className="mb-4">
          <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-700 mb-2">
            AI Provider
          </label>
          <select
            id="ai-provider"
            value={settings.ai_provider || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleProviderChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Use System Default</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        {settings.ai_provider && (
          <div className="mb-6">
            <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700 mb-2">
              AI Model
            </label>
            <select
              id="ai-model"
              value={settings.ai_model || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleModelChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Use Provider Default</option>
              {availableModels.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
