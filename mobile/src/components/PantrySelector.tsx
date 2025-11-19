import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Button, Portal, Dialog, TextInput, Text, List, IconButton } from 'react-native-paper';
import apiClient from '../api/client';
import type { Pantry } from '../types';

interface PantrySelectorProps {
  selectedPantryId?: number;
  onPantryChange: (pantryId: number | undefined) => void;
}

export const PantrySelector: React.FC<PantrySelectorProps> = ({
  selectedPantryId,
  onPantryChange,
}) => {
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
      <Button
        mode="outlined"
        onPress={() => setSelectorDialogVisible(true)}
        style={styles.button}
        contentStyle={styles.buttonContent}
      >
        {selectedPantry ? `${selectedPantry.name}${selectedPantry.is_default ? ' (Default)' : ''}` : 'Select Pantry'}
      </Button>

      <Portal>
        <Dialog 
          visible={selectorDialogVisible} 
          onDismiss={() => setSelectorDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Select Pantry</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView>
              {pantries.map((pantry) => (
                <TouchableOpacity
                  key={pantry.id}
                  onPress={() => handleSelectPantry(pantry.id)}
                  style={[
                    styles.pantryItem,
                    selectedPantryId === pantry.id && styles.selectedPantryItem
                  ]}
                >
                  <List.Item
                    title={pantry.name}
                    description={pantry.description || pantry.location || undefined}
                    left={(props) => (
                      <List.Icon 
                        {...props} 
                        icon={pantry.is_default ? "home" : "store"} 
                      />
                    )}
                    right={(props) => (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {selectedPantryId === pantry.id && (
                          <List.Icon {...props} icon="check" color="#0284c7" />
                        )}
                        {!pantry.is_default && (
                          <IconButton
                            icon="delete"
                            size={20}
                            iconColor="#dc2626"
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeletePantry(pantry);
                            }}
                          />
                        )}
                      </View>
                    )}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button 
              onPress={() => {
                setSelectorDialogVisible(false);
                setCreateDialogVisible(true);
              }}
              icon="plus"
              mode="contained"
            >
              New Pantry
            </Button>
            <Button onPress={() => setSelectorDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={createDialogVisible} onDismiss={() => setCreateDialogVisible(false)}>
          <Dialog.Title>Create New Pantry</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name *"
              value={newPantryName}
              onChangeText={setNewPantryName}
              style={styles.input}
              placeholder="e.g., Home, Office"
              mode="outlined"
            />
            <TextInput
              label="Description"
              value={newPantryDescription}
              onChangeText={setNewPantryDescription}
              style={styles.input}
              placeholder="Optional description"
              mode="outlined"
            />
            <TextInput
              label="Location"
              value={newPantryLocation}
              onChangeText={setNewPantryLocation}
              style={styles.input}
              placeholder="Optional address/location"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleCreatePantry} disabled={!newPantryName.trim()}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  button: {
    minWidth: 150,
  },
  buttonContent: {
    paddingVertical: 4,
  },
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  pantryItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectedPantryItem: {
    backgroundColor: '#eff6ff',
  },
  input: {
    marginBottom: 8,
  },
});

