import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Button, Portal, Dialog, TextInput, Text, List, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { DesignSystem, getDesignSystem, getTextStyle } from '../utils/designSystem';
import { PremiumButton } from './PremiumButton';
import type { Pantry } from '../types';

interface PantrySelectorProps {
  selectedPantryId?: number;
  onPantryChange: (pantryId: number | undefined) => void;
}

export const PantrySelector: React.FC<PantrySelectorProps> = ({
  selectedPantryId,
  onPantryChange,
}) => {
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const [pantries, setPantries] = useState<Pantry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectorDialogVisible, setSelectorDialogVisible] = useState(false);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [newPantryName, setNewPantryName] = useState('');
  const [newPantryDescription, setNewPantryDescription] = useState('');
  const [newPantryLocation, setNewPantryLocation] = useState('');

  useEffect(() => {
    loadPantries();
  }, []);

  const loadPantries = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getPantries();
      setPantries(data);
      
      // If no pantry is selected and we have pantries, select the default one
      if (!selectedPantryId && data.length > 0) {
        const defaultPantry = data.find(p => p.is_default) || data[0];
        onPantryChange(defaultPantry.id);
      }
    } catch (err: any) {
      console.error('Error loading pantries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePantry = async () => {
    if (!newPantryName.trim()) {
      return;
    }

    try {
      const newPantry = await apiClient.createPantry({
        name: newPantryName.trim(),
        description: newPantryDescription.trim() || undefined,
        location: newPantryLocation.trim() || undefined,
        is_default: pantries.length === 0,
      });
      
      setPantries([...pantries, newPantry]);
      onPantryChange(newPantry.id);
      setCreateDialogVisible(false);
      setNewPantryName('');
      setNewPantryDescription('');
      setNewPantryLocation('');
    } catch (err: any) {
      console.error('Error creating pantry:', err);
    }
  };

  const handleSelectPantry = (pantryId: number) => {
    onPantryChange(pantryId);
    setSelectorDialogVisible(false);
  };

  const handleDeletePantry = async (pantry: Pantry) => {
    if (pantry.is_default) {
      Alert.alert('Cannot Delete', 'You cannot delete the default pantry. Set another pantry as default first.');
      return;
    }

    Alert.alert(
      'Delete Pantry',
      `Are you sure you want to delete "${pantry.name}"? Items in this pantry will be unassigned (pantry_id set to NULL).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deletePantry(pantry.id);
              await loadPantries();
              // If deleted pantry was selected, switch to default
              if (selectedPantryId === pantry.id) {
                const remainingPantries = pantries.filter(p => p.id !== pantry.id);
                if (remainingPantries.length > 0) {
                  const defaultPantry = remainingPantries.find(p => p.is_default) || remainingPantries[0];
                  onPantryChange(defaultPantry.id);
                } else {
                  onPantryChange(undefined);
                }
              }
              Alert.alert('Success', 'Pantry deleted successfully');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete pantry');
            }
          },
        },
      ]
    );
  };

  const selectedPantry = pantries.find(p => p.id === selectedPantryId);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        testID="pantry-selector-button"
        onPress={() => setSelectorDialogVisible(true)}
        style={[
          styles.selectorButton,
          { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }
        ]}
        activeOpacity={0.6}
        accessibilityLabel={selectedPantry ? `Pantry: ${selectedPantry.name}` : 'Select pantry'}
        accessibilityRole="button"
      >
        <View style={styles.selectorContent}>
          <View style={styles.selectorText}>
            <Text style={[styles.selectorLabel, { color: ds.colors.textTertiary }]}>
              PANTRY
            </Text>
            <Text style={[styles.selectorValue, { color: ds.colors.textPrimary }]}>
              {selectedPantry ? selectedPantry.name : 'Select Pantry'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={20} color={ds.colors.textTertiary} style={{ opacity: 0.4 }} />
        </View>
      </TouchableOpacity>

      <Portal>
        <Dialog 
          visible={selectorDialogVisible} 
          onDismiss={() => setSelectorDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Select Pantry</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {pantries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyStateText, { color: ds.colors.textPrimary }]}>No pantries yet</Text>
                  <Text style={[styles.emptyStateSubtext, { color: ds.colors.textSecondary }]}>Create your first pantry to get started</Text>
                </View>
              ) : (
                pantries.map((pantry, index) => (
                  <TouchableOpacity
                    key={pantry.id}
                    onPress={() => handleSelectPantry(pantry.id)}
                    style={[
                      styles.pantryItem,
                      { 
                        borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        borderBottomWidth: index < pantries.length - 1 ? 1 : 0,
                      }
                    ]}
                    activeOpacity={0.6}
                    accessibilityLabel={`Select pantry ${pantry.name}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.pantryContent}>
                      <Text style={[styles.pantryName, { color: ds.colors.textPrimary }]}>
                        {pantry.name}
                      </Text>
                      {(pantry.description || pantry.location) && (
                        <Text style={[styles.pantryDescription, { color: ds.colors.textSecondary }]}>
                          {pantry.description || pantry.location}
                        </Text>
                      )}
                    </View>
                    <View style={styles.pantryActions}>
                      {selectedPantryId === pantry.id && (
                        <MaterialCommunityIcons 
                          name="check" 
                          size={22} 
                          color={ds.colors.textPrimary}
                          style={{ marginRight: 8 }}
                        />
                      )}
                      {!pantry.is_default && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeletePantry(pantry);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityLabel={`Delete pantry ${pantry.name}`}
                          accessibilityRole="button"
                        >
                          <MaterialCommunityIcons 
                            name="delete-outline" 
                            size={22} 
                            color={ds.colors.textTertiary}
                            style={{ opacity: 0.6 }}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              testID="pantry-selector-close"
              onPress={() => setSelectorDialogVisible(false)}
              mode="text"
              labelStyle={styles.dialogActionLabel}
              uppercase={false}
              accessibilityLabel="Close pantry selector"
              accessibilityRole="button"
            >
              Close
            </Button>
            <PremiumButton 
              testID="pantry-selector-new"
              onPress={() => {
                setSelectorDialogVisible(false);
                setCreateDialogVisible(true);
              }}
              mode="contained"
              style={{ elevation: 0 }}
              accessibilityLabel="Create new pantry"
              accessibilityRole="button"
            >
              New Pantry
            </PremiumButton>
          </Dialog.Actions>
        </Dialog>

        <Dialog 
          visible={createDialogVisible} 
          onDismiss={() => setCreateDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle} accessibilityRole="header" accessibilityLabel="Create New Pantry">Create New Pantry</Dialog.Title>
          <Dialog.Content>
            <TextInput
              testID="pantry-create-name"
              label="Name *"
              value={newPantryName}
              onChangeText={setNewPantryName}
              style={styles.input}
              placeholder="e.g., Home, Office"
              mode="outlined"
              accessibilityLabel="Pantry name"
              accessibilityRole="none"
            />
            <TextInput
              testID="pantry-create-description"
              label="Description"
              value={newPantryDescription}
              onChangeText={setNewPantryDescription}
              style={styles.input}
              placeholder="Optional description"
              mode="outlined"
              accessibilityLabel="Pantry description"
              accessibilityRole="none"
            />
            <TextInput
              testID="pantry-create-location"
              label="Location"
              value={newPantryLocation}
              onChangeText={setNewPantryLocation}
              style={styles.input}
              placeholder="Optional address/location"
              mode="outlined"
              accessibilityLabel="Pantry location"
              accessibilityRole="none"
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button 
              testID="pantry-create-cancel" 
              onPress={() => setCreateDialogVisible(false)}
              mode="text"
              labelStyle={styles.dialogActionLabel}
              uppercase={false}
              accessibilityLabel="Cancel create pantry"
              accessibilityRole="button"
            >
              Cancel
            </Button>
            <PremiumButton 
              testID="pantry-create-submit" 
              onPress={handleCreatePantry} 
              disabled={!newPantryName.trim()}
              mode="contained"
              style={{ elevation: 0 }}
              accessibilityLabel="Create pantry"
              accessibilityRole="button"
            >
              Create
            </PremiumButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // No margin - integrated into page flow
  },
  // Selector Button - Minimal
  selectorButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.55,
  },
  selectorValue: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  // Dialog - Minimal
  dialog: {
    borderRadius: 20,
  },
  dialogTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  dialogContent: {
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 400,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  // Empty State - Minimal
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
  },
  // Pantry Items - Clean list
  pantryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  pantryContent: {
    flex: 1,
  },
  pantryName: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pantryDescription: {
    fontSize: 14,
    opacity: 0.6,
    letterSpacing: -0.1,
  },
  pantryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  dialogActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
  dialogActionLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  input: {
    marginBottom: 12,
  },
});

