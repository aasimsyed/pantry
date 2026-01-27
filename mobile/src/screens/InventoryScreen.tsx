import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Alert, TouchableOpacity, Pressable } from 'react-native';
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
  Menu,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/client';
import { PantrySelector } from '../components/PantrySelector';
import { PremiumButton } from '../components/PremiumButton';
import { useTheme } from '../contexts/ThemeContext';
import { DesignSystem, getDesignSystem, getTextStyle } from '../utils/designSystem';
import type { InventoryItem } from '../types';

export default function InventoryScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [selectedPantryId, setSelectedPantryId] = useState<number | undefined>();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [photoStorageLocation, setPhotoStorageLocation] = useState<'pantry' | 'fridge' | 'freezer'>('pantry');
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
  const [editUnitMenuVisible, setEditUnitMenuVisible] = useState(false);
  const [editUnitMenuKey, setEditUnitMenuKey] = useState(0);
  const [manualEntryDialogVisible, setManualEntryDialogVisible] = useState(false);
  const [manualEntryFormData, setManualEntryFormData] = useState({
    product_name: '',
    brand: '',
    quantity: 1,
    unit: 'count',
    storage_location: 'pantry' as 'pantry' | 'fridge' | 'freezer',
    status: 'in_stock' as 'in_stock' | 'low',
    expiration_date: '',
    purchase_date: '',
    notes: '',
  });
  const [manualUnitMenuVisible, setManualUnitMenuVisible] = useState(false);
  const [manualUnitMenuKey, setManualUnitMenuKey] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);

  // Common cooking units
  const cookingUnits = [
    { label: 'Count (items)', value: 'count' },
    { label: 'Teaspoon (tsp)', value: 'tsp' },
    { label: 'Tablespoon (tbsp)', value: 'tbsp' },
    { label: 'Cup', value: 'cup' },
    { label: 'Fluid Ounce (fl oz)', value: 'fl oz' },
    { label: 'Pint (pt)', value: 'pt' },
    { label: 'Quart (qt)', value: 'qt' },
    { label: 'Gallon (gal)', value: 'gal' },
    { label: 'Ounce (oz)', value: 'oz' },
    { label: 'Pound (lb)', value: 'lb' },
    { label: 'Milliliter (ml)', value: 'ml' },
    { label: 'Liter (L)', value: 'L' },
    { label: 'Gram (g)', value: 'g' },
    { label: 'Kilogram (kg)', value: 'kg' },
    { label: 'Package', value: 'package' },
    { label: 'Can', value: 'can' },
    { label: 'Bottle', value: 'bottle' },
    { label: 'Jar', value: 'jar' },
    { label: 'Bag', value: 'bag' },
    { label: 'Box', value: 'box' },
  ];

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
      const result = await apiClient.processImage(uri, photoStorageLocation, selectedPantryId);
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

  const handleManualEntry = async () => {
    if (!manualEntryFormData.product_name.trim()) {
      Alert.alert('Error', 'Product name is required');
      return;
    }

    if (selectedPantryId === undefined) {
      Alert.alert('Error', 'Please select a pantry first');
      return;
    }

    try {
      setProcessing(true);
      
      // Create or find product
      let productId: number;
      try {
        const existing = await apiClient.searchProducts(manualEntryFormData.product_name);
        if (existing.length > 0) {
          productId = existing[0].id;
        } else {
          const product = await apiClient.createProduct({
            product_name: manualEntryFormData.product_name,
            brand: manualEntryFormData.brand || undefined,
          });
          productId = product.id;
        }
      } catch {
        // If search fails, create new product
        const product = await apiClient.createProduct({
          product_name: manualEntryFormData.product_name,
          brand: manualEntryFormData.brand || undefined,
        });
        productId = product.id;
      }

      // Create inventory item
      await apiClient.createInventoryItem({
        product_id: productId,
        quantity: manualEntryFormData.quantity,
        unit: manualEntryFormData.unit,
        storage_location: manualEntryFormData.storage_location,
        status: manualEntryFormData.status,
        purchase_date: manualEntryFormData.purchase_date || undefined,
        expiration_date: manualEntryFormData.expiration_date || undefined,
        notes: manualEntryFormData.notes || undefined,
        pantry_id: selectedPantryId,
      });

      Alert.alert('Success', `Added ${manualEntryFormData.product_name} to inventory!`);
      setManualEntryDialogVisible(false);
      setManualEntryFormData({
        product_name: '',
        brand: '',
        quantity: 1,
        unit: 'count',
        storage_location: 'pantry',
        status: 'in_stock',
        expiration_date: '',
        purchase_date: '',
        notes: '',
      });
      await loadInventory();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add item');
    } finally {
      setProcessing(false);
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
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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
          testID="inventory-search"
          placeholder="Search inventory..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <View style={styles.chipContainer}>
          {['All', 'pantry', 'fridge', 'freezer'].map((loc) => (
            <Chip
              key={loc}
              testID={`location-filter-${loc.toLowerCase()}`}
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

        {filteredItems.map((item) => {
          // Clean up product name to remove duplicate brand names
          let displayName = item.product_name || 'Unknown';
          if (item.brand && item.product_name) {
            const brand = item.brand.trim();
            let name = item.product_name;
            
            const brandLower = brand.toLowerCase();
            const nameLower = name.toLowerCase();
            
            if (nameLower.startsWith(brandLower)) {
              const afterBrand = name.substring(brand.length);
              name = afterBrand.replace(/^[\s-]+/, '').trim();
            }
            
            const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const brandRegex = new RegExp(`(^|\\s)${escapedBrand}(\\s|$)`, 'gi');
            name = name.replace(brandRegex, (match, before, after) => {
              return before || '';
            }).trim();
            
            const words = name.split(/\s+/);
            const filteredWords = words.filter(word => 
              word.toLowerCase() !== brandLower
            );
            name = filteredWords.join(' ');
            name = name.replace(/\s+/g, ' ').trim();
            
            if (name.length === 0) {
              name = item.product_name;
            }
            
            displayName = name;
          }

          const locationColor = item.storage_location === 'pantry' 
            ? ds.colors.pantry 
            : item.storage_location === 'fridge'
            ? ds.colors.fridge
            : ds.colors.freezer;

          return (
            <TouchableOpacity
              key={item.id}
              testID={`inventory-item-${item.id}`}
              activeOpacity={0.9}
              onPress={() => handleEditItem(item)}
            >
              <Card style={[styles.modernCard, { backgroundColor: ds.colors.surface, ...ds.shadows.md }]}>
                <Card.Content style={styles.modernCardContent}>
                  <View style={styles.modernCardHeader}>
                    <View style={styles.modernCardTitleSection}>
                      <Text style={[styles.modernProductName, { color: ds.colors.textPrimary }]}>{displayName}</Text>
                      {item.brand && (
                        <View style={[styles.brandBadge, { backgroundColor: ds.colors.surfaceHover }]}>
                          <Text style={[styles.brandText, { color: ds.colors.textSecondary }]}>{item.brand}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.modernCardActions}>
                      <TouchableOpacity
                        style={[styles.actionIconButton, { backgroundColor: ds.colors.surfaceHover }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleEditItem(item);
                        }}
                      >
                        <MaterialCommunityIcons name="pencil" size={20} color={ds.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionIconButton, { backgroundColor: ds.colors.surfaceHover }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item);
                        }}
                      >
                        <MaterialCommunityIcons name="delete" size={20} color={ds.colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.modernDetailsRow}>
                    <View style={[styles.quantityBadge, { backgroundColor: ds.colors.surfaceHover }]}>
                      <MaterialCommunityIcons name="scale" size={16} color={ds.colors.textSecondary} />
                      <Text style={[styles.quantityText, getTextStyle('label', ds.colors.textPrimary, isDark)]}>
                        {item.quantity} {item.unit}
                      </Text>
                    </View>
                    <View style={[styles.locationBadge, { backgroundColor: `${locationColor}15` }]}>
                      <MaterialCommunityIcons 
                        name={item.storage_location === 'pantry' ? 'archive' : item.storage_location === 'fridge' ? 'fridge' : 'snowflake'} 
                        size={16} 
                        color={locationColor} 
                      />
                      <Text style={[styles.locationText, { color: locationColor }]}>
                        {item.storage_location?.charAt(0).toUpperCase()}{item.storage_location?.slice(1)}
                      </Text>
                    </View>
                  </View>
                  
                  {item.expiration_date && (
                    <View style={styles.expirationRow}>
                      <MaterialCommunityIcons name="calendar-clock" size={16} color={ds.colors.warning} />
                      <Text style={[styles.expirationText, getTextStyle('caption', ds.colors.warning, isDark)]}>
                        Expires: {new Date(item.expiration_date).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'plus'}
        fabStyle={[styles.fab, { backgroundColor: ds.colors.accent }]}
        style={styles.fabGroup}
        color={ds.colors.surface}
        actions={[
          {
            icon: 'pencil',
            label: 'Add Manually',
            onPress: () => setManualEntryDialogVisible(true),
            style: { backgroundColor: ds.colors.primary },
            color: ds.colors.surface,
            labelStyle: { fontWeight: '600' },
          },
          {
            icon: 'barcode-scan',
            label: 'Scan Barcode',
            onPress: () => navigation.navigate('BarcodeScanner' as never, { 
              pantryId: selectedPantryId,
              storageLocation: 'pantry'
            } as never),
            style: { backgroundColor: ds.colors.info },
            color: ds.colors.surface,
            labelStyle: { fontWeight: '600' },
          },
          {
            icon: 'camera',
            label: 'Scan Label',
            onPress: () => setDialogVisible(true),
            style: { backgroundColor: ds.colors.accent },
            color: ds.colors.surface,
            labelStyle: { fontWeight: '600' },
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
      />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ borderRadius: 24 }}>
          <Dialog.Title style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }}>Add Item</Dialog.Title>
          <Dialog.Content style={{ paddingTop: 20 }}>
            <Text variant="bodyMedium" style={[styles.locationLabel, { color: ds.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 }]}>
              Storage Location
            </Text>
            <View style={styles.locationSelector}>
              <TouchableOpacity
                onPress={() => setPhotoStorageLocation('pantry')}
                style={[
                  styles.modernLocationButton,
                  { 
                    backgroundColor: photoStorageLocation === 'pantry' ? ds.colors.primary : ds.colors.surface,
                    borderColor: photoStorageLocation === 'pantry' ? ds.colors.primary : ds.colors.surfaceHover,
                  }
                ]}
              >
                <Text style={{ fontSize: 20 }}>🥫</Text>
                <Text style={{ 
                  color: photoStorageLocation === 'pantry' ? ds.colors.textInverse : ds.colors.textPrimary,
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  Pantry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPhotoStorageLocation('fridge')}
                style={[
                  styles.modernLocationButton,
                  { 
                    backgroundColor: photoStorageLocation === 'fridge' ? ds.colors.primary : ds.colors.surface,
                    borderColor: photoStorageLocation === 'fridge' ? ds.colors.primary : ds.colors.surfaceHover,
                  }
                ]}
              >
                <Text style={{ fontSize: 20 }}>🧊</Text>
                <Text style={{ 
                  color: photoStorageLocation === 'fridge' ? ds.colors.textInverse : ds.colors.textPrimary,
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  Fridge
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPhotoStorageLocation('freezer')}
                style={[
                  styles.modernLocationButton,
                  { 
                    backgroundColor: photoStorageLocation === 'freezer' ? ds.colors.primary : ds.colors.surface,
                    borderColor: photoStorageLocation === 'freezer' ? ds.colors.primary : ds.colors.surfaceHover,
                  }
                ]}
              >
                <Text style={{ fontSize: 20 }}>❄️</Text>
                <Text style={{ 
                  color: photoStorageLocation === 'freezer' ? ds.colors.textInverse : ds.colors.textPrimary,
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  Freezer
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.separator, { backgroundColor: ds.colors.surfaceHover }]} />
            <PremiumButton
              testID="add-item-take-photo"
              mode="contained"
              onPress={handleTakePhoto}
              style={styles.dialogButton}
            >
              📷 Take Photo
            </PremiumButton>
            <PremiumButton
              testID="add-item-choose-photo"
              mode="outlined"
              onPress={handlePickImage}
              style={styles.dialogButton}
            >
              🖼️ Choose from Library
            </PremiumButton>
            <PremiumButton
              testID="add-item-manual-entry"
              mode="outlined"
              onPress={() => {
                setDialogVisible(false);
                setManualEntryDialogVisible(true);
              }}
              style={styles.dialogButton}
            >
              ✏️ Manual Entry
            </PremiumButton>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} labelStyle={{ fontSize: 16, fontWeight: '600' }} uppercase={false}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {processing && (
        <Portal>
          <Dialog visible={processing} dismissable={false}>
            <Dialog.Content>
              <ActivityIndicator size="large" />
              <Text style={styles.processingText}>Processing...</Text>
            </Dialog.Content>
          </Dialog>
        </Portal>
      )}

      {/* Manual Entry Dialog */}
      <Portal>
        <Dialog
          visible={manualEntryDialogVisible}
          onDismiss={() => setManualEntryDialogVisible(false)}
          style={[styles.editDialog, { borderRadius: 24 }]}
        >
          <Dialog.Title style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }}>Add Item Manually</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              <TextInput
                testID="manual-entry-product-name"
                label="Product Name *"
                value={manualEntryFormData.product_name}
                onChangeText={(text) =>
                  setManualEntryFormData({ ...manualEntryFormData, product_name: text })
                }
                style={styles.input}
                mode="outlined"
                placeholder="e.g., Dried Chickpeas"
              />
              <TextInput
                testID="manual-entry-brand"
                label="Brand (optional)"
                value={manualEntryFormData.brand}
                onChangeText={(text) =>
                  setManualEntryFormData({ ...manualEntryFormData, brand: text })
                }
                style={styles.input}
                mode="outlined"
                placeholder="e.g., Generic"
              />
              <TextInput
                label="Quantity"
                value={manualEntryFormData.quantity.toString()}
                onChangeText={(text) =>
                  setManualEntryFormData({
                    ...manualEntryFormData,
                    quantity: parseFloat(text) || 0,
                  })
                }
                keyboardType="numeric"
                style={styles.input}
                mode="outlined"
              />
              <Menu
                key={manualUnitMenuKey}
                visible={manualUnitMenuVisible}
                onDismiss={() => setManualUnitMenuVisible(false)}
                anchor={
                  <Pressable onPress={() => setManualUnitMenuVisible(true)}>
                    <TextInput
                      label="Unit"
                      value={cookingUnits.find(u => u.value === manualEntryFormData.unit)?.label || manualEntryFormData.unit}
                      style={styles.input}
                      mode="outlined"
                      right={<TextInput.Icon icon="menu-down" />}
                      editable={false}
                      pointerEvents="none"
                    />
                  </Pressable>
                }
                contentStyle={{
                  backgroundColor: ds.colors.surface,
                  borderRadius: 12,
                  maxHeight: 400,
                  width: '100%',
                }}
                anchorPosition="bottom"
              >
                <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                  {cookingUnits.map((unit) => (
                    <Menu.Item
                      key={unit.value}
                      onPress={() => {
                        setManualEntryFormData({ ...manualEntryFormData, unit: unit.value });
                        setManualUnitMenuVisible(false);
                        setManualUnitMenuKey(prev => prev + 1);
                      }}
                      title={unit.label}
                      titleStyle={{ fontSize: 15 }}
                    />
                  ))}
                </ScrollView>
              </Menu>
              <View style={styles.locationContainer}>
                <Text variant="bodyMedium" style={[styles.label, { color: ds.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 }]}>
                  Storage Location
                </Text>
                <View style={styles.locationButtons}>
                  {(['pantry', 'fridge', 'freezer'] as const).map((loc) => {
                    const emoji = loc === 'pantry' ? '🥫' : loc === 'fridge' ? '🧊' : '❄️';
                    const label = loc === 'pantry' ? 'Pantry' : loc === 'fridge' ? 'Fridge' : 'Freezer';
                    return (
                      <TouchableOpacity
                        key={loc}
                        onPress={() => setManualEntryFormData({ ...manualEntryFormData, storage_location: loc })}
                        style={[
                          styles.editLocationButton,
                          { 
                            backgroundColor: manualEntryFormData.storage_location === loc ? ds.colors.primary : ds.colors.surface,
                            borderColor: manualEntryFormData.storage_location === loc ? ds.colors.primary : ds.colors.surfaceHover,
                          }
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                        <Text style={{ 
                          color: manualEntryFormData.storage_location === loc ? ds.colors.textInverse : ds.colors.textPrimary,
                          fontSize: 14,
                          fontWeight: '600',
                        }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.locationContainer}>
                <Text variant="bodyMedium" style={[styles.label, { color: ds.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 }]}>
                  Status
                </Text>
                <View style={styles.locationButtons}>
                  {(['in_stock', 'low'] as const).map((stat) => (
                    <TouchableOpacity
                      key={stat}
                      onPress={() => setManualEntryFormData({ ...manualEntryFormData, status: stat })}
                      style={[
                        styles.editLocationButton,
                        { 
                          backgroundColor: manualEntryFormData.status === stat ? ds.colors.success : ds.colors.surface,
                          borderColor: manualEntryFormData.status === stat ? ds.colors.success : ds.colors.surfaceHover,
                        }
                      ]}
                    >
                      <Text style={{ 
                        color: manualEntryFormData.status === stat ? ds.colors.textInverse : ds.colors.textPrimary,
                        fontSize: 14,
                        fontWeight: '600',
                      }}>
                        {stat === 'in_stock' ? '✓ In Stock' : '⚠️ Low'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TextInput
                label="Expiration Date (optional)"
                value={manualEntryFormData.expiration_date}
                onChangeText={(text) =>
                  setManualEntryFormData({ ...manualEntryFormData, expiration_date: text })
                }
                style={styles.input}
                mode="outlined"
                placeholder="YYYY-MM-DD"
              />
              <TextInput
                label="Purchase Date (optional)"
                value={manualEntryFormData.purchase_date}
                onChangeText={(text) =>
                  setManualEntryFormData({ ...manualEntryFormData, purchase_date: text })
                }
                style={styles.input}
                mode="outlined"
                placeholder="YYYY-MM-DD"
              />
              <TextInput
                label="Notes (optional)"
                value={manualEntryFormData.notes}
                onChangeText={(text) =>
                  setManualEntryFormData({ ...manualEntryFormData, notes: text })
                }
                style={styles.input}
                mode="outlined"
                multiline
                numberOfLines={3}
                placeholder="Additional notes..."
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button testID="manual-entry-cancel" onPress={() => setManualEntryDialogVisible(false)} labelStyle={{ fontSize: 16, fontWeight: '600' }} uppercase={false}>
              Cancel
            </Button>
            <PremiumButton
              testID="manual-entry-submit"
              mode="contained"
              onPress={handleManualEntry}
              disabled={processing || !manualEntryFormData.product_name.trim()}
            >
              Add Item
            </PremiumButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Item Dialog */}
      <Portal>
        <Dialog
          visible={editDialogVisible}
          onDismiss={() => setEditDialogVisible(false)}
          style={[styles.editDialog, { borderRadius: 24 }]}
        >
          <Dialog.Title style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }}>
            Edit Item: {editingItem?.product_name}
          </Dialog.Title>
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
                mode="outlined"
              />
              <Menu
                key={editUnitMenuKey}
                visible={editUnitMenuVisible}
                onDismiss={() => setEditUnitMenuVisible(false)}
                anchor={
                  <Pressable onPress={() => setEditUnitMenuVisible(true)}>
                    <TextInput
                      label="Unit"
                      value={cookingUnits.find(u => u.value === editFormData.unit)?.label || editFormData.unit}
                      style={styles.input}
                      mode="outlined"
                      right={<TextInput.Icon icon="menu-down" />}
                      editable={false}
                      pointerEvents="none"
                    />
                  </Pressable>
                }
                contentStyle={{
                  backgroundColor: ds.colors.surface,
                  borderRadius: 12,
                  maxHeight: 400,
                  width: '100%',
                }}
                anchorPosition="bottom"
              >
                <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                  {cookingUnits.map((unit) => (
                    <Menu.Item
                      key={unit.value}
                      onPress={() => {
                        setEditFormData({ ...editFormData, unit: unit.value });
                        setEditUnitMenuVisible(false);
                        setEditUnitMenuKey(prev => prev + 1);
                      }}
                      title={unit.label}
                      titleStyle={{ fontSize: 15 }}
                    />
                  ))}
                </ScrollView>
              </Menu>
              <View style={styles.locationContainer}>
                <Text variant="bodyMedium" style={[styles.label, { color: ds.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 }]}>
                  Storage Location
                </Text>
                <View style={styles.locationButtons}>
                  {(['pantry', 'fridge', 'freezer'] as const).map((loc) => {
                    const emoji = loc === 'pantry' ? '🥫' : loc === 'fridge' ? '🧊' : '❄️';
                    const label = loc === 'pantry' ? 'Pantry' : loc === 'fridge' ? 'Fridge' : 'Freezer';
                    return (
                      <TouchableOpacity
                        key={loc}
                        onPress={() => setEditFormData({ ...editFormData, storage_location: loc })}
                        style={[
                          styles.editLocationButton,
                          { 
                            backgroundColor: editFormData.storage_location === loc ? ds.colors.primary : ds.colors.surface,
                            borderColor: editFormData.storage_location === loc ? ds.colors.primary : ds.colors.surfaceHover,
                          }
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                        <Text style={{ 
                          color: editFormData.storage_location === loc ? ds.colors.textInverse : ds.colors.textPrimary,
                          fontSize: 14,
                          fontWeight: '600',
                        }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.locationContainer}>
                <Text variant="bodyMedium" style={[styles.label, { color: ds.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 }]}>
                  Status
                </Text>
                <View style={styles.locationButtons}>
                  {(['in_stock', 'low'] as const).map((stat) => (
                    <TouchableOpacity
                      key={stat}
                      onPress={() => setEditFormData({ ...editFormData, status: stat })}
                      style={[
                        styles.editLocationButton,
                        { 
                          backgroundColor: editFormData.status === stat ? ds.colors.success : ds.colors.surface,
                          borderColor: editFormData.status === stat ? ds.colors.success : ds.colors.surfaceHover,
                        }
                      ]}
                    >
                      <Text style={{ 
                        color: editFormData.status === stat ? ds.colors.textInverse : ds.colors.textPrimary,
                        fontSize: 14,
                        fontWeight: '600',
                      }}>
                        {stat === 'in_stock' ? '✓ In Stock' : '⚠️ Low'}
                      </Text>
                    </TouchableOpacity>
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
                mode="outlined"
              />
              <TextInput
                label="Purchase Date (YYYY-MM-DD)"
                value={editFormData.purchase_date}
                onChangeText={(text) =>
                  setEditFormData({ ...editFormData, purchase_date: text })
                }
                style={styles.input}
                placeholder="2024-11-18"
                mode="outlined"
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
                mode="outlined"
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button testID="edit-item-cancel" onPress={() => setEditDialogVisible(false)} labelStyle={{ fontSize: 16, fontWeight: '600' }} uppercase={false}>
              Cancel
            </Button>
            <PremiumButton testID="edit-item-save" mode="contained" onPress={handleUpdateItem}>
              Save
            </PremiumButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingTop: 12,
  },
  searchbar: {
    marginBottom: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    ...DesignSystem.shadows.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: DesignSystem.spacing.md,
    marginHorizontal: -DesignSystem.spacing.xs,
  },
  chip: {
    marginRight: DesignSystem.spacing.sm,
    marginBottom: DesignSystem.spacing.sm,
    marginHorizontal: DesignSystem.spacing.xs,
    borderRadius: DesignSystem.borderRadius.full,
  },
  count: {
    marginBottom: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.sm,
  },
  // Modern Card Styles
  modernCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modernCardContent: {
    padding: 20,
  },
  modernCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modernCardTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  modernProductName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
    marginBottom: 6,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modernCardActions: {
    flexDirection: 'row',
    gap: DesignSystem.spacing.xs,
  },
  actionIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernDetailsRow: {
    flexDirection: 'row',
    gap: DesignSystem.spacing.sm,
    marginBottom: DesignSystem.spacing.sm,
    flexWrap: 'wrap',
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignSystem.spacing.sm,
    paddingVertical: DesignSystem.spacing.xs,
    borderRadius: DesignSystem.borderRadius.md,
    gap: DesignSystem.spacing.xs,
  },
  quantityText: {
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignSystem.spacing.sm,
    paddingVertical: DesignSystem.spacing.xs,
    borderRadius: DesignSystem.borderRadius.md,
    gap: DesignSystem.spacing.xs,
  },
  locationText: {
    ...getTextStyle('label'),
    fontWeight: '600',
  },
  expirationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.xs,
    marginTop: DesignSystem.spacing.xs,
  },
  expirationText: {
  },
  // Legacy styles (keeping for compatibility)
  card: {
    marginBottom: DesignSystem.spacing.md,
    ...DesignSystem.shadows.md,
  },
  brand: {
    marginTop: DesignSystem.spacing.xs,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: DesignSystem.spacing.sm,
  },
  location: {
  },
  expiration: {
    marginTop: DesignSystem.spacing.xs,
  },
  fab: {
    borderRadius: 9999,
    elevation: 8,
  },
  fabGroup: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingBottom: 24,
    paddingRight: 16,
  },
  dialogButton: {
    marginVertical: 6,
  },
  locationLabel: {
    marginBottom: DesignSystem.spacing.sm,
  },
  locationSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  locationButton: {
    flex: 1,
  },
  modernLocationButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    gap: 6,
  },
  editLocationButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  separator: {
    height: 1,
    marginVertical: DesignSystem.spacing.md,
  },
  // Modern Dialog Styles
  modernDialog: {
    borderRadius: DesignSystem.borderRadius.xl,
  },
  modernDialogTitle: {
    paddingBottom: DesignSystem.spacing.sm,
  },
  modernDialogContent: {
    paddingTop: DesignSystem.spacing.md,
  },
  modernLocationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.sm,
    borderRadius: DesignSystem.borderRadius.md,
    borderWidth: 2,
    gap: DesignSystem.spacing.xs,
  },
  modernLocationButtonActive: {
    // Colors applied inline
  },
  modernLocationButtonText: {
  },
  modernLocationButtonTextActive: {
    fontWeight: '600',
  },
  modernDialogActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DesignSystem.spacing.md,
    paddingHorizontal: DesignSystem.spacing.md,
    borderRadius: DesignSystem.borderRadius.md,
    marginBottom: DesignSystem.spacing.sm,
    gap: DesignSystem.spacing.sm,
    ...DesignSystem.shadows.sm,
  },
  modernDialogActionButtonOutlined: {
    borderWidth: 2,
  },
  modernDialogActionText: {
    fontWeight: '600',
  },
  modernDialogActionTextOutlined: {
  },
  modernDialogActions: {
    paddingHorizontal: DesignSystem.spacing.md,
    paddingBottom: DesignSystem.spacing.md,
  },
  modernDialogCancelLabel: {
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
    gap: 10,
  },
  locationChip: {
    marginRight: 8,
    marginBottom: 8,
  },
});

