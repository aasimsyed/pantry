import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button, Portal, Dialog, TextInput, Text } from 'react-native-paper';
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
  const [menuVisible, setMenuVisible] = useState(false);
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

  const selectedPantry = pantries.find(p => p.id === selectedPantryId);

  return (
    <View style={styles.container}>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            onPress={() => setMenuVisible(true)}
            style={styles.button}
          >
            {selectedPantry ? `${selectedPantry.name}${selectedPantry.is_default ? ' (Default)' : ''}` : 'Select Pantry'}
          </Button>
        }
      >
        {pantries.map((pantry) => (
          <Menu.Item
            key={pantry.id}
            onPress={() => {
              onPantryChange(pantry.id);
              setMenuVisible(false);
            }}
            title={`${pantry.name}${pantry.is_default ? ' (Default)' : ''}`}
          />
        ))}
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            setCreateDialogVisible(true);
          }}
          title="+ New Pantry"
        />
      </Menu>

      <Portal>
        <Dialog visible={createDialogVisible} onDismiss={() => setCreateDialogVisible(false)}>
          <Dialog.Title>Create New Pantry</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name *"
              value={newPantryName}
              onChangeText={setNewPantryName}
              style={styles.input}
              placeholder="e.g., Home, Office"
            />
            <TextInput
              label="Description"
              value={newPantryDescription}
              onChangeText={setNewPantryDescription}
              style={styles.input}
              placeholder="Optional description"
            />
            <TextInput
              label="Location"
              value={newPantryLocation}
              onChangeText={setNewPantryLocation}
              style={styles.input}
              placeholder="Optional address/location"
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
  input: {
    marginBottom: 8,
  },
});

