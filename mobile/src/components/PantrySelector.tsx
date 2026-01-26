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
      <PremiumButton
        testID="pantry-selector-button"
        mode="outlined"
        onPress={() => setSelectorDialogVisible(true)}
        style={styles.button}
      >
        {selectedPantry ? `${selectedPantry.name}${selectedPantry.is_default ? ' (Default)' : ''}` : 'Select Pantry'}
      </PremiumButton>

      <Portal>
        <Dialog 
          visible={selectorDialogVisible} 
          onDismiss={() => setSelectorDialogVisible(false)}
          style={[styles.modernDialog, { backgroundColor: ds.colors.surface, ...ds.shadows.xl }]}
        >
          <Dialog.Title style={[styles.modernDialogTitle, { color: ds.colors.textPrimary, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }]}>Select Pantry</Dialog.Title>
          <Dialog.Content style={styles.modernDialogContent}>
            <ScrollView 
              style={styles.modernScrollView}
              contentContainerStyle={styles.modernScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {pantries.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="store-outline" size={48} color={ds.colors.textTertiary} />
                  <Text style={[styles.emptyStateText, getTextStyle('title', ds.colors.textPrimary, isDark)]}>No pantries yet</Text>
                  <Text style={[styles.emptyStateSubtext, getTextStyle('body', ds.colors.textSecondary, isDark)]}>Create your first pantry to get started</Text>
                </View>
              ) : (
                pantries.map((pantry) => (
                  <TouchableOpacity
                    key={pantry.id}
                    onPress={() => handleSelectPantry(pantry.id)}
                    style={[
                      styles.modernPantryItem,
                      { backgroundColor: ds.colors.surface, ...ds.shadows.md },
                      selectedPantryId === pantry.id && { backgroundColor: `${ds.colors.primary}10`, borderColor: ds.colors.primary, borderWidth: 2 }
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modernPantryItemContent}>
                      <View style={[
                        styles.modernPantryIcon,
                        { backgroundColor: ds.colors.surfaceHover },
                        selectedPantryId === pantry.id && { backgroundColor: ds.colors.primary }
                      ]}>
                        <MaterialCommunityIcons 
                          name={pantry.is_default ? "home" : "store"} 
                          size={28} 
                          color={selectedPantryId === pantry.id ? ds.colors.surface : ds.colors.primary} 
                        />
                      </View>
                      <View style={styles.modernPantryTextContainer}>
                        <View style={styles.modernPantryTitleRow}>
                          <Text style={[styles.modernPantryName, { color: ds.colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 }]}>{pantry.name}</Text>
                          {pantry.is_default && (
                            <View style={[styles.defaultBadge, { backgroundColor: ds.colors.primary }]}>
                              <Text style={[styles.defaultBadgeText, { color: ds.colors.surface, fontSize: 11, fontWeight: '600', letterSpacing: 0.2 }]}>DEFAULT</Text>
                            </View>
                          )}
                        </View>
                        {(pantry.description || pantry.location) && (
                          <Text style={[styles.modernPantryDescription, { color: ds.colors.textSecondary, fontSize: 14, lineHeight: 20 }]}>
                            {pantry.description || pantry.location}
                          </Text>
                        )}
                      </View>
                      <View style={styles.modernPantryActions}>
                        {selectedPantryId === pantry.id && (
                          <MaterialCommunityIcons 
                            name="check-circle" 
                            size={28} 
                            color={ds.colors.primary} 
                          />
                        )}
                        {!pantry.is_default && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeletePantry(pantry);
                            }}
                            style={styles.deleteButton}
                          >
                            <MaterialCommunityIcons 
                              name="delete-outline" 
                              size={24} 
                              color={ds.colors.error} 
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={styles.modernDialogActions}>
            <PremiumButton 
              testID="pantry-selector-new"
              onPress={() => {
                setSelectorDialogVisible(false);
                setCreateDialogVisible(true);
              }}
              mode="contained"
              style={styles.newPantryButton}
            >
              New Pantry
            </PremiumButton>
            <PremiumButton 
              testID="pantry-selector-close"
              onPress={() => setSelectorDialogVisible(false)}
              mode="text"
              textColor={ds.colors.textSecondary}
            >
              Close
            </PremiumButton>
          </Dialog.Actions>
        </Dialog>

        <Dialog 
          visible={createDialogVisible} 
          onDismiss={() => setCreateDialogVisible(false)}
          style={{ borderRadius: 24 }}
        >
          <Dialog.Title style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }}>Create New Pantry</Dialog.Title>
          <Dialog.Content>
            <TextInput
              testID="pantry-create-name"
              label="Name *"
              value={newPantryName}
              onChangeText={setNewPantryName}
              style={styles.input}
              placeholder="e.g., Home, Office"
              mode="outlined"
            />
            <TextInput
              testID="pantry-create-description"
              label="Description"
              value={newPantryDescription}
              onChangeText={setNewPantryDescription}
              style={styles.input}
              placeholder="Optional description"
              mode="outlined"
            />
            <TextInput
              testID="pantry-create-location"
              label="Location"
              value={newPantryLocation}
              onChangeText={setNewPantryLocation}
              style={styles.input}
              placeholder="Optional address/location"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <PremiumButton 
              testID="pantry-create-cancel" 
              onPress={() => setCreateDialogVisible(false)}
              mode="text"
            >
              Cancel
            </PremiumButton>
            <PremiumButton 
              testID="pantry-create-submit" 
              onPress={handleCreatePantry} 
              disabled={!newPantryName.trim()}
              mode="contained"
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
    marginVertical: DesignSystem.spacing.sm,
  },
  button: {
    minWidth: 150,
  },
  buttonContent: {
    paddingVertical: DesignSystem.spacing.xs,
  },
  // Modern Dialog Styles
  modernDialog: {
    maxHeight: '90%',
    height: '85%',
    marginHorizontal: 16,
    borderRadius: 24,
  },
  modernDialogTitle: {
    paddingBottom: 8,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modernDialogContent: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: DesignSystem.spacing.md,
    paddingBottom: 0,
  },
  modernScrollView: {
    flex: 1,
  },
  modernScrollContent: {
    paddingHorizontal: DesignSystem.spacing.md,
    paddingBottom: DesignSystem.spacing.md,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignSystem.spacing.xxl,
    paddingHorizontal: DesignSystem.spacing.lg,
  },
  emptyStateText: {
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    textAlign: 'center',
  },
  // Modern Pantry Item
  modernPantryItem: {
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modernSelectedPantryItem: {
  },
  modernPantryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  modernPantryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernPantryIconSelected: {
  },
  modernPantryTextContainer: {
    flex: 1,
    gap: DesignSystem.spacing.xs / 2,
  },
  modernPantryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.sm,
    flexWrap: 'wrap',
  },
  modernPantryName: {
  },
  defaultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontWeight: '600',
  },
  modernPantryDescription: {
  },
  modernPantryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.sm,
  },
  deleteButton: {
    padding: 8,
  },
  modernDialogActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    borderTopWidth: 0,
    gap: 12,
  },
  newPantryButton: {
    flex: 1,
  },
  newPantryButtonLabel: {
    fontWeight: '600',
  },
  closeButtonLabel: {
  },
  // Legacy styles
  dialog: {
    maxHeight: '90%',
  },
  scrollArea: {
    maxHeight: 500,
    paddingHorizontal: 0,
  },
  pantryItem: {
    borderBottomWidth: 1,
  },
  selectedPantryItem: {
  },
  input: {
    marginBottom: DesignSystem.spacing.sm,
  },
});

