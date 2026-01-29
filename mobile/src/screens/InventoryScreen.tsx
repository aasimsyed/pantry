import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View, Alert, TouchableOpacity, Pressable, TextInput as RNTextInput, FlatList } from 'react-native';

// Instacart branding - using approved green color
const INSTACART_GREEN = '#43B02A';
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
import { getUseCloudOcr, recognizeTextFromUri } from '../services/ocrService';
import { instacartService } from '../services/instacartService';
import { PantrySelector } from '../components/PantrySelector';
import { PremiumButton } from '../components/PremiumButton';
import { InstacartLogo } from '../components/InstacartLogo';
import { ScreenContentWrapper } from '../components/ScreenContentWrapper';
import { useTheme } from '../contexts/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { getDesignSystem } from '../utils/designSystem';
import type { InventoryItem } from '../types';

export default function InventoryScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const layout = useLayout();
  const ds = getDesignSystem(isDark);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [instacartLoading, setInstacartLoading] = useState(false);
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
      const useCloudOcr = await getUseCloudOcr();
      let result;
      if (useCloudOcr) {
        result = await apiClient.processImage(uri, photoStorageLocation, selectedPantryId);
      } else {
        const text = await recognizeTextFromUri(uri);
        if (text) {
          result = await apiClient.processFromText(text, photoStorageLocation, selectedPantryId);
        } else {
          result = await apiClient.processImage(uri, photoStorageLocation, selectedPantryId);
        }
      }
      if (result.success) {
        const ocrHint = result.ocr_source === 'device' ? ' (read on device)' : result.ocr_source === 'cloud' ? ' (read on server)' : '';
        Alert.alert('Success', `Processed: ${result.item.product_name || 'Unknown'}${ocrHint}`);
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

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (searchQuery) {
          const name = item.product_name?.toLowerCase() || '';
          return name.includes(searchQuery.toLowerCase());
        }
        return true;
      }),
    [items, searchQuery]
  );

  const keyExtractor = useCallback((item: InventoryItem) => item.id.toString(), []);

  const getItemDisplayName = useCallback((item: InventoryItem): string => {
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
      name = name.replace(brandRegex, (_m, before) => before || '').trim();
      const words = name.split(/\s+/).filter((w) => w.toLowerCase() !== brandLower);
      name = words.join(' ').replace(/\s+/g, ' ').trim();
      if (name.length > 0) displayName = name;
    }
    return displayName;
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: InventoryItem; index: number }) => {
      const displayName = getItemDisplayName(item);
      const isLowStock = item.status === 'low';
      const isLast = index === filteredItems.length - 1;
      return (
        <TouchableOpacity
          testID={`inventory-item-${item.id}`}
          style={[
            styles.inventoryItem,
            {
              borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              borderBottomWidth: isLast ? 0 : 1,
              borderLeftWidth: isLowStock ? 2 : 0,
              borderLeftColor: isLowStock ? (isDark ? 'rgba(249, 115, 22, 0.4)' : 'rgba(249, 115, 22, 0.3)') : 'transparent',
            },
          ]}
          onPress={() => handleEditItem(item)}
          activeOpacity={0.6}
          accessibilityLabel={`Edit ${displayName}`}
          accessibilityRole="button"
        >
          <View style={styles.itemMain}>
            <View style={styles.itemContent}>
              <Text
                style={[styles.itemName, { color: ds.colors.textPrimary, fontWeight: isLowStock ? '600' : '500' }]}
                numberOfLines={2}
              >
                {displayName}
              </Text>
              <View style={styles.itemMeta}>
                {item.brand && (
                  <Text style={[styles.itemBrand, { color: ds.colors.textSecondary }]}>{item.brand}</Text>
                )}
                <Text
                  style={[
                    styles.itemQuantity,
                    {
                      color: isLowStock
                        ? isDark
                          ? 'rgba(249, 115, 22, 0.9)'
                          : 'rgba(249, 115, 22, 0.8)'
                        : ds.colors.textSecondary,
                    },
                  ]}
                >
                  {item.quantity} {item.unit}
                </Text>
                <Text style={[styles.itemLocation, { color: ds.colors.textTertiary }]}>
                  · {item.storage_location}
                </Text>
              </View>
              {item.expiration_date && (
                <Text style={[styles.itemExpiration, { color: ds.colors.warning }]}>
                  Expires {new Date(item.expiration_date).toLocaleDateString()}
                </Text>
              )}
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteItem(item);
                }}
                style={styles.itemActionButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={`Delete ${displayName}`}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="delete-outline" size={22} color={ds.colors.textTertiary} style={{ opacity: 0.6 }} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [filteredItems.length, getItemDisplayName, isDark, ds.colors, handleEditItem, handleDeleteItem]
  );

  const listHeaderComponent = useMemo(
    () => (
      <ScreenContentWrapper>
        <View style={[styles.searchContainer, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
          <MaterialCommunityIcons name="magnify" size={22} color={ds.colors.textPrimary} style={{ opacity: 0.5 }} />
          <RNTextInput
            testID="inventory-search"
            placeholder="Search inventory..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={[styles.searchInput, { color: ds.colors.textPrimary, backgroundColor: 'transparent' }]}
            placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'}
            autoCapitalize="none"
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear search" accessibilityRole="button">
              <MaterialCommunityIcons name="close-circle" size={20} color={ds.colors.textPrimary} style={{ opacity: 0.5 }} accessibilityElementsHidden />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterContainer}>
          {['All', 'pantry', 'fridge', 'freezer'].map((loc) => (
            <TouchableOpacity
              key={loc}
              testID={`location-filter-${loc.toLowerCase()}`}
              onPress={() => setLocationFilter(loc)}
              style={[
                styles.filterButton,
                locationFilter === loc && styles.filterButtonActive,
                {
                  borderColor:
                    locationFilter === loc ? ds.colors.textPrimary : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                },
              ]}
              accessibilityLabel={`Filter by ${loc}`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterText,
                  { color: locationFilter === loc ? ds.colors.textPrimary : ds.colors.textSecondary },
                  locationFilter === loc && { fontWeight: '500' },
                ]}
              >
                {loc.charAt(0).toUpperCase() + loc.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {items.filter((i) => i.status === 'low').length > 0 && (
          <TouchableOpacity
            onPress={() => instacartService.shopLowStockItems(items, setInstacartLoading)}
            disabled={instacartLoading}
            style={[
              styles.instacartButton,
              {
                backgroundColor: '#F5E6D3',
                borderColor: isDark ? 'rgba(0, 168, 98, 0.3)' : 'rgba(0, 168, 98, 0.2)',
              },
            ]}
            activeOpacity={0.7}
            accessibilityLabel={`Shop low stock on Instacart (${items.filter((i) => i.status === 'low').length} items)`}
            accessibilityRole="button"
          >
            {instacartLoading ? (
              <ActivityIndicator size="small" color={INSTACART_GREEN} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <InstacartLogo width={100} height={18} />
                <Text style={[styles.instacartButtonText, { color: ds.colors.textSecondary, fontSize: 13 }]}>
                  ({items.filter((i) => i.status === 'low').length} items)
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <Text style={[styles.countLabel, { color: ds.colors.textTertiary }]}>{filteredItems.length} ITEMS</Text>
      </ScreenContentWrapper>
    ),
    [
      searchQuery,
      locationFilter,
      items,
      instacartLoading,
      filteredItems.length,
      isDark,
      ds.colors.textPrimary,
      ds.colors.textSecondary,
      ds.colors.textTertiary,
    ]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['top', 'bottom']}>
      {loading ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            layout.isTablet && { paddingHorizontal: layout.horizontalPadding, alignItems: 'center' },
          ]}
        >
          <PantrySelector selectedPantryId={selectedPantryId} onPantryChange={setSelectedPantryId} />
          <ScreenContentWrapper>
            <View style={styles.center}>
              <ActivityIndicator size="large" />
            </View>
          </ScreenContentWrapper>
        </ScrollView>
      ) : (
        <View style={styles.listWrapper}>
          <PantrySelector selectedPantryId={selectedPantryId} onPantryChange={setSelectedPantryId} />
          <FlatList
            data={filteredItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeaderComponent}
            contentContainerStyle={[
              styles.listContent,
              layout.isTablet && { paddingHorizontal: layout.horizontalPadding },
            ]}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Add Button - Minimal FAB */}
      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'plus'}
        fabStyle={[
          styles.fab, 
          { 
            backgroundColor: ds.colors.textPrimary,
            elevation: 0,
          }
        ]}
        style={styles.fabGroup}
        color={ds.colors.background}
        actions={[
          {
            icon: 'pencil-outline',
            label: 'Add Manually',
            onPress: () => setManualEntryDialogVisible(true),
            style: { 
              backgroundColor: ds.colors.textPrimary,
              elevation: 0,
            },
            color: ds.colors.background,
            labelStyle: { fontWeight: '500', letterSpacing: -0.2 },
          },
          {
            icon: 'barcode-scan',
            label: 'Scan Barcode',
            onPress: () => navigation.navigate('BarcodeScanner' as never, { 
              pantryId: selectedPantryId,
              storageLocation: 'pantry'
            } as never),
            style: { 
              backgroundColor: ds.colors.textPrimary,
              elevation: 0,
            },
            color: ds.colors.background,
            labelStyle: { fontWeight: '500', letterSpacing: -0.2 },
          },
          {
            icon: 'camera-outline',
            label: 'Scan Label',
            onPress: () => setDialogVisible(true),
            style: { 
              backgroundColor: ds.colors.textPrimary,
              elevation: 0,
            },
            color: ds.colors.background,
            labelStyle: { fontWeight: '500', letterSpacing: -0.2 },
          },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
      />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Add Item</Dialog.Title>
          <Dialog.Content style={{ paddingTop: 20 }}>
            <Text style={[styles.dialogLabel, { color: ds.colors.textTertiary }]}>
              STORAGE LOCATION
            </Text>
            <View style={styles.locationSelector}>
              <TouchableOpacity
                onPress={() => setPhotoStorageLocation('pantry')}
                style={[
                  styles.locationOption,
                  { 
                    borderColor: photoStorageLocation === 'pantry' 
                      ? ds.colors.textPrimary 
                      : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                  }
                ]}
                accessibilityLabel="Storage: Pantry"
                accessibilityRole="button"
              >
                <Text style={[
                  styles.locationOptionText,
                  { color: photoStorageLocation === 'pantry' ? ds.colors.textPrimary : ds.colors.textSecondary },
                  photoStorageLocation === 'pantry' && { fontWeight: '500' }
                ]}>
                  Pantry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPhotoStorageLocation('fridge')}
                style={[
                  styles.locationOption,
                  { 
                    borderColor: photoStorageLocation === 'fridge' 
                      ? ds.colors.textPrimary 
                      : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                  }
                ]}
                accessibilityLabel="Storage: Fridge"
                accessibilityRole="button"
              >
                <Text style={[
                  styles.locationOptionText,
                  { color: photoStorageLocation === 'fridge' ? ds.colors.textPrimary : ds.colors.textSecondary },
                  photoStorageLocation === 'fridge' && { fontWeight: '500' }
                ]}>
                  Fridge
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPhotoStorageLocation('freezer')}
                style={[
                  styles.locationOption,
                  { 
                    borderColor: photoStorageLocation === 'freezer' 
                      ? ds.colors.textPrimary 
                      : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                  }
                ]}
                accessibilityLabel="Storage: Freezer"
                accessibilityRole="button"
              >
                <Text style={[
                  styles.locationOptionText,
                  { color: photoStorageLocation === 'freezer' ? ds.colors.textPrimary : ds.colors.textSecondary },
                  photoStorageLocation === 'freezer' && { fontWeight: '500' }
                ]}>
                  Freezer
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />
            <Button
              testID="add-item-take-photo"
              mode="text"
              onPress={handleTakePhoto}
              style={styles.dialogAction}
              labelStyle={styles.dialogActionLabel}
              contentStyle={styles.dialogActionContent}
              uppercase={false}
              accessibilityLabel="Take photo"
              accessibilityRole="button"
            >
              Take Photo
            </Button>
            <Button
              testID="add-item-choose-photo"
              mode="text"
              onPress={handlePickImage}
              style={styles.dialogAction}
              labelStyle={styles.dialogActionLabel}
              contentStyle={styles.dialogActionContent}
              uppercase={false}
              accessibilityLabel="Choose from library"
              accessibilityRole="button"
            >
              Choose from Library
            </Button>
            <Button
              testID="add-item-manual-entry"
              mode="text"
              accessibilityLabel="Add item manually"
              accessibilityRole="button"
              onPress={() => {
                setDialogVisible(false);
                setManualEntryDialogVisible(true);
              }}
              style={styles.dialogAction}
              labelStyle={styles.dialogActionLabel}
              contentStyle={styles.dialogActionContent}
              uppercase={false}
            >
              Manual Entry
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} labelStyle={styles.cancelLabel} uppercase={false}>
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
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Add Item Manually</Dialog.Title>
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
                  <Pressable onPress={() => setManualUnitMenuVisible(true)} accessibilityLabel="Unit" accessibilityRole="button">
                    <TextInput
                      label="Unit"
                      value={cookingUnits.find(u => u.value === manualEntryFormData.unit)?.label || manualEntryFormData.unit}
                      style={styles.input}
                      mode="outlined"
                      right={<TextInput.Icon icon="menu-down" />}
                      editable={false}
                      pointerEvents="none"
                      accessibilityLabel="Unit"
                      accessibilityRole="none"
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
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  STORAGE LOCATION
                </Text>
                <View style={styles.optionButtons}>
                  {(['pantry', 'fridge', 'freezer'] as const).map((loc) => {
                    const label = loc === 'pantry' ? 'Pantry' : loc === 'fridge' ? 'Fridge' : 'Freezer';
                    return (
                      <TouchableOpacity
                        key={loc}
                        onPress={() => setManualEntryFormData({ ...manualEntryFormData, storage_location: loc })}
                        style={[
                          styles.optionButton,
                          { 
                            borderColor: manualEntryFormData.storage_location === loc 
                              ? ds.colors.textPrimary 
                              : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                          }
                        ]}
                        accessibilityLabel={`Storage: ${label}`}
                        accessibilityRole="button"
                      >
                        <Text style={[
                          styles.optionButtonText,
                          { color: manualEntryFormData.storage_location === loc ? ds.colors.textPrimary : ds.colors.textSecondary },
                          manualEntryFormData.storage_location === loc && { fontWeight: '500' }
                        ]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  STATUS
                </Text>
                <View style={styles.optionButtons}>
                  {(['in_stock', 'low'] as const).map((stat) => (
                    <TouchableOpacity
                      key={stat}
                      onPress={() => setManualEntryFormData({ ...manualEntryFormData, status: stat })}
                      style={[
                        styles.optionButton,
                        { 
                          borderColor: manualEntryFormData.status === stat 
                            ? ds.colors.textPrimary 
                            : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                        }
                      ]}
                      accessibilityLabel={stat === 'in_stock' ? 'Status: In stock' : 'Status: Low stock'}
                      accessibilityRole="button"
                    >
                      <Text style={[
                        styles.optionButtonText,
                        { color: manualEntryFormData.status === stat ? ds.colors.textPrimary : ds.colors.textSecondary },
                        manualEntryFormData.status === stat && { fontWeight: '500' }
                      ]}>
                        {stat === 'in_stock' ? 'In Stock' : 'Low Stock'}
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
            <Button testID="manual-entry-cancel" onPress={() => setManualEntryDialogVisible(false)} labelStyle={styles.cancelLabel} uppercase={false}>
              Cancel
            </Button>
            <PremiumButton
              testID="manual-entry-submit"
              mode="contained"
              onPress={handleManualEntry}
              disabled={processing || !manualEntryFormData.product_name.trim()}
              style={{ elevation: 0 }}
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
          style={[styles.dialog, { backgroundColor: ds.colors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: ds.colors.textPrimary }]}>
            Edit Item
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Product Name - Read Only */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  PRODUCT
                </Text>
                <Text style={[styles.formValue, { color: ds.colors.textPrimary }]}>
                  {editingItem?.product_name}
                </Text>
              </View>

              {/* Quantity & Unit */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  QUANTITY
                </Text>
                <View style={styles.quantityRow}>
                  <RNTextInput
                    value={editFormData.quantity.toString()}
                    onChangeText={(text) =>
                      setEditFormData({
                        ...editFormData,
                        quantity: parseFloat(text) || 0,
                      })
                    }
                    keyboardType="numeric"
                    style={[
                      styles.quantityInput,
                      { 
                        color: ds.colors.textPrimary,
                        borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                      }
                    ]}
                    placeholderTextColor={ds.colors.textTertiary}
                    underlineColorAndroid="transparent"
                  />
                  <Menu
                    key={editUnitMenuKey}
                    visible={editUnitMenuVisible}
                    onDismiss={() => setEditUnitMenuVisible(false)}
                    anchor={
                      <TouchableOpacity 
                        onPress={() => setEditUnitMenuVisible(true)}
                        style={[
                          styles.unitSelector,
                          { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)' }
                        ]}
                      >
                        <Text style={[styles.unitSelectorText, { color: ds.colors.textPrimary }]}>
                          {cookingUnits.find(u => u.value === editFormData.unit)?.label || editFormData.unit}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={ds.colors.textTertiary} style={{ opacity: 0.4 }} />
                      </TouchableOpacity>
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
                </View>
              </View>

              {/* Storage Location */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  STORAGE LOCATION
                </Text>
                <View style={styles.optionButtons}>
                  {(['pantry', 'fridge', 'freezer'] as const).map((loc) => {
                    const label = loc === 'pantry' ? 'Pantry' : loc === 'fridge' ? 'Fridge' : 'Freezer';
                    return (
                      <TouchableOpacity
                        key={loc}
                        onPress={() => setEditFormData({ ...editFormData, storage_location: loc })}
                        style={[
                          styles.optionButton,
                          { 
                            borderColor: editFormData.storage_location === loc 
                              ? ds.colors.textPrimary 
                              : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                          }
                        ]}
                      >
                        <Text style={[
                          styles.optionButtonText,
                          { color: editFormData.storage_location === loc ? ds.colors.textPrimary : ds.colors.textSecondary },
                          editFormData.storage_location === loc && { fontWeight: '500' }
                        ]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Status */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  STATUS
                </Text>
                <View style={styles.optionButtons}>
                  {(['in_stock', 'low'] as const).map((stat) => (
                    <TouchableOpacity
                      key={stat}
                      onPress={() => setEditFormData({ ...editFormData, status: stat })}
                      style={[
                        styles.optionButton,
                        { 
                          borderColor: editFormData.status === stat 
                            ? ds.colors.textPrimary 
                            : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                        }
                      ]}
                    >
                      <Text style={[
                        styles.optionButtonText,
                        { color: editFormData.status === stat ? ds.colors.textPrimary : ds.colors.textSecondary },
                        editFormData.status === stat && { fontWeight: '500' }
                      ]}>
                        {stat === 'in_stock' ? 'In Stock' : 'Low Stock'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dates */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  EXPIRATION DATE
                </Text>
                <RNTextInput
                  value={editFormData.expiration_date}
                  onChangeText={(text) =>
                    setEditFormData({ ...editFormData, expiration_date: text })
                  }
                  placeholder="YYYY-MM-DD"
                  style={[
                    styles.textInputMinimal,
                    { 
                      color: ds.colors.textPrimary,
                      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                    }
                  ]}
                  placeholderTextColor={ds.colors.textTertiary}
                  underlineColorAndroid="transparent"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  PURCHASE DATE
                </Text>
                <RNTextInput
                  value={editFormData.purchase_date}
                  onChangeText={(text) =>
                    setEditFormData({ ...editFormData, purchase_date: text })
                  }
                  placeholder="YYYY-MM-DD"
                  style={[
                    styles.textInputMinimal,
                    { 
                      color: ds.colors.textPrimary,
                      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                    }
                  ]}
                  placeholderTextColor={ds.colors.textTertiary}
                  underlineColorAndroid="transparent"
                />
              </View>

              {/* Notes */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: ds.colors.textTertiary }]}>
                  NOTES
                </Text>
                <RNTextInput
                  value={editFormData.notes}
                  onChangeText={(text) =>
                    setEditFormData({ ...editFormData, notes: text })
                  }
                  multiline
                  numberOfLines={3}
                  placeholder="Add notes..."
                  style={[
                    styles.textInputMinimal,
                    styles.textInputMultiline,
                    { 
                      color: ds.colors.textPrimary,
                      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                    }
                  ]}
                  placeholderTextColor={ds.colors.textTertiary}
                  underlineColorAndroid="transparent"
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button testID="edit-item-cancel" onPress={() => setEditDialogVisible(false)} labelStyle={styles.cancelLabel} uppercase={false}>
              Cancel
            </Button>
            <Button testID="edit-item-save" mode="text" onPress={handleUpdateItem} labelStyle={[styles.cancelLabel, { fontWeight: '600' }]} uppercase={false}>
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
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 100, // Space for FAB
  },
  listWrapper: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100, // Space for FAB
  },
  // Search - Minimal, no background, pure text
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    marginLeft: 14,
    marginRight: 8,
    padding: 0,
    margin: 0,
    letterSpacing: -0.2,
    fontWeight: '400',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Filters - Minimal pills
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonActive: {
    // Border color applied inline
  },
  filterText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  instacartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    // borderColor is set inline to be theme-aware
  },
  instacartButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  countLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    paddingHorizontal: 24,
    marginBottom: 12,
    opacity: 0.55,
  },
  // Inventory Items - Clean list
  inventoryItem: {
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  itemBrand: {
    fontSize: 14,
    letterSpacing: -0.1,
    opacity: 0.6,
  },
  itemQuantity: {
    fontSize: 14,
    letterSpacing: -0.1,
    opacity: 0.6,
  },
  itemLocation: {
    fontSize: 14,
    letterSpacing: -0.1,
    opacity: 0.55,
    textTransform: 'capitalize',
  },
  itemExpiration: {
    fontSize: 13,
    marginTop: 6,
    opacity: 0.9,
  },
  itemActions: {
    marginLeft: 12,
    paddingTop: 2,
  },
  itemActionButton: {
    // Minimal - just icon with hit slop
  },
  // FAB - Minimal, no elevation
  fab: {
    borderRadius: 16, // Less rounded, more refined
    elevation: 0,
  },
  fabGroup: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingBottom: 24,
    paddingRight: 24,
  },
  // Dialogs - Minimal
  dialog: {
    borderRadius: 20,
  },
  dialogTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  dialogLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.55,
  },
  dialogAction: {
    marginBottom: 4,
    justifyContent: 'flex-start',
  },
  dialogActionLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  dialogActionContent: {
    justifyContent: 'flex-start',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  locationSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  locationOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  locationOptionText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  separator: {
    height: 1,
    marginVertical: 20,
  },
  processingText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 15,
  },
  // Edit Dialog
  editDialog: {
    maxHeight: '90%',
    borderRadius: 20,
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
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.55,
  },
  formValue: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  unitSelectorText: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  textInputMinimal: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.3,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  optionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionButtonText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
});

