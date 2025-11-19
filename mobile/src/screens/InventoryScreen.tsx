import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  Searchbar,
  Chip,
  FAB,
  Dialog,
  Portal,
  TextInput,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/client';
import { PantrySelector } from '../components/PantrySelector';
import type { InventoryItem } from '../types';

export default function InventoryScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [selectedPantryId, setSelectedPantryId] = useState<number | undefined>();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    quantity: 1,
    unit: 'count',
    storage_location: 'pantry' as 'pantry' | 'fridge' | 'freezer',
    status: 'in_stock' as 'in_stock' | 'low',
    expiration_date: '',
    purchase_date: '',
    notes: '',
  });

  useEffect(() => {
    if (selectedPantryId !== undefined) {
      loadInventory();
    }
  }, [locationFilter, selectedPantryId]);

  const loadInventory = async () => {
    if (selectedPantryId === undefined) return;
    
    try {
      setLoading(true);
      const location = locationFilter === 'All' ? undefined : locationFilter;
      const data = await apiClient.getInventory(0, 1000, location, undefined, selectedPantryId);
      setItems(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        // mediaTypes defaults to images, so we can omit it
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processImage(result.assets[0].uri);
      } else if (result.canceled) {
        // User canceled - do nothing
        return;
      }
    } catch (error: any) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', error.message || 'Failed to take photo');
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // mediaTypes defaults to images, so we can omit it
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processImage(result.assets[0].uri);
      } else if (result.canceled) {
        // User canceled - do nothing
        return;
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };

  const processImage = async (uri: string) => {
    try {
      setProcessing(true);
      setDialogVisible(false);
      const result = await apiClient.processImage(uri, 'pantry');
      if (result.success) {
        Alert.alert('Success', `Processed: ${result.item.product_name || 'Unknown'}`);
        await loadInventory();
      } else {
        Alert.alert('Error', 'Failed to process image');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.product_name || 'this item'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteInventoryItem(item.id);
              Alert.alert('Success', 'Item deleted successfully');
              await loadInventory();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setEditFormData({
      quantity: item.quantity,
      unit: item.unit,
      storage_location: item.storage_location || 'pantry',
      status: item.status as 'in_stock' | 'low',
      expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
      purchase_date: item.purchase_date ? item.purchase_date.split('T')[0] : '',
      notes: item.notes || '',
    });
    setEditDialogVisible(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      await apiClient.updateInventoryItem(editingItem.id, {
        quantity: editFormData.quantity,
        unit: editFormData.unit,
        storage_location: editFormData.storage_location,
        status: editFormData.status,
        expiration_date: editFormData.expiration_date || undefined,
        purchase_date: editFormData.purchase_date || undefined,
        notes: editFormData.notes || undefined,
      });

      Alert.alert('Success', 'Item updated successfully!');
      setEditDialogVisible(false);
      setEditingItem(null);
      await loadInventory();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update item');
    }
  };

  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      const name = item.product_name?.toLowerCase() || '';
      return name.includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 16 }]}>
        <PantrySelector
          selectedPantryId={selectedPantryId}
          onPantryChange={setSelectedPantryId}
        />
        
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        )}
        
        <Searchbar
          placeholder="Search inventory..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <View style={styles.chipContainer}>
          {['All', 'pantry', 'fridge', 'freezer'].map((loc) => (
            <Chip
              key={loc}
              selected={locationFilter === loc}
              onPress={() => setLocationFilter(loc)}
              style={styles.chip}
            >
              {loc.charAt(0).toUpperCase() + loc.slice(1)}
            </Chip>
          ))}
        </View>

        <Text variant="titleMedium" style={styles.count}>
          {filteredItems.length} items
        </Text>

        {filteredItems.map((item) => (
          <Card key={item.id} style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <Text variant="titleMedium">{item.product_name || 'Unknown'}</Text>
                  {item.brand && (
                    <Text variant="bodySmall" style={styles.brand}>
                      Brand: {item.brand}
                    </Text>
                  )}
                </View>
                <View style={styles.cardActions}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => handleEditItem(item)}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    iconColor="#dc2626"
                    onPress={() => handleDeleteItem(item)}
                  />
                </View>
              </View>
              <View style={styles.details}>
                <Text variant="bodyMedium">
                  {item.quantity} {item.unit}
                </Text>
                <Text variant="bodySmall" style={styles.location}>
                  📍 {item.storage_location?.charAt(0).toUpperCase()}
                  {item.storage_location?.slice(1)}
                </Text>
              </View>
              {item.expiration_date && (
                <Text variant="bodySmall" style={styles.expiration}>
                  📅 Expires: {new Date(item.expiration_date).toLocaleDateString()}
                </Text>
              )}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <FAB
        icon="camera"
        style={styles.fab}
        onPress={() => setDialogVisible(true)}
      />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>Process Image</Dialog.Title>
          <Dialog.Content>
            <Button
              mode="contained"
              icon="camera"
              onPress={handleTakePhoto}
              style={styles.dialogButton}
            >
              Take Photo
            </Button>
            <Button
              mode="outlined"
              icon="image"
              onPress={handlePickImage}
              style={styles.dialogButton}
            >
              Choose from Library
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {processing && (
        <Portal>
          <Dialog visible={processing} dismissable={false}>
            <Dialog.Content>
              <ActivityIndicator size="large" />
              <Text style={styles.processingText}>Processing image...</Text>
            </Dialog.Content>
          </Dialog>
        </Portal>
      )}

      {/* Edit Item Dialog */}
      <Portal>
        <Dialog
          visible={editDialogVisible}
          onDismiss={() => setEditDialogVisible(false)}
          style={styles.editDialog}
        >
          <Dialog.Title>Edit Item: {editingItem?.product_name}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              <TextInput
                label="Quantity"
                value={editFormData.quantity.toString()}
                onChangeText={(text) =>
                  setEditFormData({
                    ...editFormData,
                    quantity: parseFloat(text) || 0,
                  })
                }
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                label="Unit"
                value={editFormData.unit}
                onChangeText={(text) =>
                  setEditFormData({ ...editFormData, unit: text })
                }
                style={styles.input}
              />
              <View style={styles.locationContainer}>
                <Text variant="bodyMedium" style={styles.label}>
                  Location *
                </Text>
                <View style={styles.locationButtons}>
                  {(['pantry', 'fridge', 'freezer'] as const).map((loc) => (
                    <Chip
                      key={loc}
                      selected={editFormData.storage_location === loc}
                      onPress={() =>
                        setEditFormData({ ...editFormData, storage_location: loc })
                      }
                      style={styles.locationChip}
                    >
                      {loc.charAt(0).toUpperCase() + loc.slice(1)}
                    </Chip>
                  ))}
                </View>
              </View>
              <View style={styles.locationContainer}>
                <Text variant="bodyMedium" style={styles.label}>
                  Status
                </Text>
                <View style={styles.locationButtons}>
                  {(['in_stock', 'low'] as const).map((stat) => (
                    <Chip
                      key={stat}
                      selected={editFormData.status === stat}
                      onPress={() =>
                        setEditFormData({ ...editFormData, status: stat })
                      }
                      style={styles.locationChip}
                    >
                      {stat === 'in_stock' ? 'In Stock' : 'Low'}
                    </Chip>
                  ))}
                </View>
              </View>
              <TextInput
                label="Expiration Date (YYYY-MM-DD)"
                value={editFormData.expiration_date}
                onChangeText={(text) =>
                  setEditFormData({ ...editFormData, expiration_date: text })
                }
                style={styles.input}
                placeholder="2024-12-31"
              />
              <TextInput
                label="Purchase Date (YYYY-MM-DD)"
                value={editFormData.purchase_date}
                onChangeText={(text) =>
                  setEditFormData({ ...editFormData, purchase_date: text })
                }
                style={styles.input}
                placeholder="2024-11-18"
              />
              <TextInput
                label="Notes"
                value={editFormData.notes}
                onChangeText={(text) =>
                  setEditFormData({ ...editFormData, notes: text })
                }
                multiline
                numberOfLines={3}
                style={styles.input}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleUpdateItem}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  searchbar: {
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  count: {
    marginBottom: 12,
    fontWeight: '600',
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  brand: {
    color: '#6b7280',
    marginTop: 4,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  location: {
    color: '#6b7280',
  },
  expiration: {
    color: '#f97316',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#0284c7',
  },
  dialogButton: {
    marginVertical: 8,
  },
  processingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardActions: {
    flexDirection: 'row',
  },
  cardTitle: {
    flex: 1,
  },
  editDialog: {
    maxHeight: '90%',
  },
  scrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  input: {
    marginBottom: 12,
  },
  locationContainer: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  locationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  locationChip: {
    marginRight: 8,
    marginBottom: 8,
  },
});

