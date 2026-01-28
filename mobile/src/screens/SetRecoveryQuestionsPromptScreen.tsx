import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button, Menu, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import { PremiumButton } from '../components/PremiumButton';
import apiClient from '../api/client';

export default function SetRecoveryQuestionsPromptScreen() {
  const { completeRecoveryQuestions } = useAuth();
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);

  const [recoveryData, setRecoveryData] = useState<{
    all_questions: Array<{ id: number; text: string }>;
    user_question_ids: number[];
  } | null>(null);
  const [recoveryForm, setRecoveryForm] = useState<Array<{ question_id: number; answer: string }>>([
    { question_id: 1, answer: '' },
    { question_id: 2, answer: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState<0 | 1 | null>(null);

  useEffect(() => {
    apiClient.getRecoveryQuestions().then(setRecoveryData).catch(() => setRecoveryData(null));
  }, []);

  const handleSave = async () => {
    if (!recoveryData) return;
    if (recoveryForm.some((r) => !r.answer.trim())) {
      Alert.alert('Missing answers', 'Please answer both questions.');
      return;
    }
    if (recoveryForm[0].question_id === recoveryForm[1].question_id) {
      Alert.alert('Different questions', 'Please choose two different questions.');
      return;
    }
    try {
      setSaving(true);
      await apiClient.setRecoveryQuestions(
        recoveryForm.map((r) => ({ question_id: r.question_id, answer: r.answer.trim() }))
      );
      completeRecoveryQuestions();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (!recoveryData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={{ color: ds.colors.textSecondary }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top']}>
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
                <MaterialCommunityIcons name="help-circle-outline" size={48} color="#3b82f6" />
              </View>
            </View>
            <Text style={[styles.title, layout.isTablet && styles.titleTablet, { color: ds.colors.textPrimary }]}>
              Set up recovery questions
            </Text>
            <Text style={[styles.subtitle, layout.isTablet && styles.subtitleTablet, { color: ds.colors.textSecondary }]}>
              For easier password reset without the Authenticator app. Choose 2 questions and answers. You can change them later in Settings.
            </Text>
            {recoveryData.all_questions.length === 0 && (
              <Text style={[styles.emptyHint, { color: ds.colors.textSecondary }]}>
                Recovery questions aren't available right now. Tap Remind me later to skip, or try again later.
              </Text>
            )}
            {[0, 1].map((idx) => (
              <View key={idx} style={styles.questionBlock}>
                <Text style={[styles.questionLabel, { color: ds.colors.textSecondary }]}>Question {idx + 1}</Text>
                <Menu
                  visible={menuVisible === idx}
                  onDismiss={() => setMenuVisible(null)}
                  anchor={
                    <Pressable
                      onPress={() => recoveryData.all_questions.length > 0 && setMenuVisible(idx)}
                      style={({ pressed }) => [
                        styles.menuButtonTouchable,
                        {
                          backgroundColor: ds.colors.surface,
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.menuButtonText, { color: ds.colors.primary }]}>
                        {recoveryData.all_questions.find((q) => q.id === recoveryForm[idx].question_id)?.text ?? 'Pick question'}
                      </Text>
                    </Pressable>
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
                        setMenuVisible(null);
                      }}
                      title={q.text}
                      titleStyle={{ color: ds.colors.textPrimary }}
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
                />
              </View>
            ))}
            <PremiumButton mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.button}>
              Save and continue
            </PremiumButton>
            <Button mode="text" onPress={completeRecoveryQuestions} style={styles.linkButton} labelStyle={styles.linkButtonLabel}>
              Remind me later
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  card: { maxWidth: 400, width: '100%', alignSelf: 'center', borderRadius: 24 },
  cardTablet: { maxWidth: 560, borderRadius: 28 },
  cardContent: { paddingVertical: 32, paddingHorizontal: 24 },
  cardContentTablet: { paddingVertical: 40, paddingHorizontal: 40 },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  titleTablet: { fontSize: 32, marginBottom: 10 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 24, textAlign: 'center' },
  subtitleTablet: { fontSize: 17, lineHeight: 26, marginBottom: 28 },
  questionBlock: { marginBottom: 16 },
  questionLabel: { fontSize: 14, marginBottom: 6 },
  menuButtonTouchable: {
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  menuButtonText: { fontSize: 16 },
  emptyHint: { marginBottom: 16, fontSize: 14 },
  input: { marginBottom: 8 },
  button: { marginTop: 8, marginBottom: 16 },
  linkButton: { marginTop: 8 },
  linkButtonLabel: { fontSize: 15, fontWeight: '500' },
});
