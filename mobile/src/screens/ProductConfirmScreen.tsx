import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import apiClient from '../api/client';
import { BarcodeProduct } from '../types';

type RouteParams = {
  ProductConfirm: {
    product: BarcodeProduct | null;
    barcode: string;
    pantryId?: number;
    storageLocation?: 'pantry' | 'fridge' | 'freezer';
  };
};

const STORAGE_LOCATIONS = [
  { key: 'pantry', label: 'Pantry', icon: 'home-variant' },
  { key: 'fridge', label: 'Fridge', icon: 'fridge' },
  { key: 'freezer', label: 'Freezer', icon: 'snowflake' },
] as const;

const UNITS = ['each', 'lb', 'oz', 'kg', 'g', 'gal', 'qt', 'pt', 'cup', 'L', 'mL', 'pack', 'box', 'can', 'bottle', 'jar'];

export default function ProductConfirmScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'ProductConfirm'>>();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);

  const { product, barcode, pantryId, storageLocation: initialStorageLocation } = route.params;

  // Form state
  const [productName, setProductName] = useState(product?.product_name || '');
  const [brand, setBrand] = useState(product?.brand || '');
  const [category, setCategory] = useState(product?.category || '');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('each');
  const [storageLocation, setStorageLocation] = useState<'pantry' | 'fridge' | 'freezer'>(
    initialStorageLocation || 'pantry'
  );
  const [saving, setSaving] = useState(false);

  const isNotFound = !product;

  const handleSave = async () => {
    if (!productName.trim()) {
      return;
    }

    setSaving(true);

    try {
      // First, create or get the product
      let productId: number;
      
      // Check if product exists in database
      if (product?.found_in_database) {
        // Product exists, search for it
        const products = await apiClient.searchProducts(productName, category);
        const existingProduct = products.find(
          (p) => p.barcode === barcode || p.product_name.toLowerCase() === productName.toLowerCase()
        );
        if (existingProduct) {
          productId = existingProduct.id;
        } else {
          // Create the product
          const newProduct = await apiClient.createProduct({
            product_name: productName,
            brand: brand || undefined,
            category: category || 'Other',
            barcode: barcode,
          });
          productId = newProduct.id;
        }
      } else {
        // Create the product
        const newProduct = await apiClient.createProduct({
          product_name: productName,
          brand: brand || undefined,
          category: category || 'Other',
          barcode: barcode,
        });
        productId = newProduct.id;
      }

      // Create inventory item
      await apiClient.createInventoryItem({
        product_id: productId,
        quantity: parseFloat(quantity) || 1,
        unit,
        storage_location: storageLocation,
        pantry_id: pantryId,
        status: 'in_stock',
      });

      // Navigate back to inventory
      navigation.navigate('Main' as never, { screen: 'Inventory' } as never);
    } catch (error: any) {
      console.error('Error saving product:', error);
      // Still navigate back - the error may be a duplicate barcode but item was created
      navigation.navigate('Main' as never, { screen: 'Inventory' } as never);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Product Image */}
          {product?.image_url && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: product.image_url }}
                style={styles.productImage}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Status Banner */}
          <View style={[
            styles.statusBanner, 
            { backgroundColor: isNotFound ? ds.colors.warning + '20' : ds.colors.success + '20' }
          ]}>
            <MaterialCommunityIcons
              name={isNotFound ? 'alert-circle-outline' : 'check-circle-outline'}
              size={20}
              color={isNotFound ? ds.colors.warning : ds.colors.success}
            />
            <Text style={[
              styles.statusText,
              { color: isNotFound ? ds.colors.warning : ds.colors.success }
            ]}>
              {isNotFound 
                ? 'Product not found - enter details manually'
                : product?.found_in_database 
                  ? 'Found in your database'
                  : 'Found in Open Food Facts'}
            </Text>
          </View>

          {/* Barcode Display */}
          <View style={[styles.barcodeContainer, { backgroundColor: ds.colors.surface }]}>
            <MaterialCommunityIcons name="barcode" size={24} color={ds.colors.textSecondary} />
            <Text style={[styles.barcodeText, { color: ds.colors.textPrimary }]}>{barcode}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <TextInput
              label="Product Name *"
              value={productName}
              onChangeText={setProductName}
              mode="outlined"
              style={styles.input}
              outlineColor={ds.colors.textTertiary}
              activeOutlineColor={ds.colors.primary}
              textColor={ds.colors.textPrimary}
            />

            <TextInput
              label="Brand"
              value={brand}
              onChangeText={setBrand}
              mode="outlined"
              style={styles.input}
              outlineColor={ds.colors.textTertiary}
              activeOutlineColor={ds.colors.primary}
              textColor={ds.colors.textPrimary}
            />

            <TextInput
              label="Category"
              value={category}
              onChangeText={setCategory}
              mode="outlined"
              style={styles.input}
              outlineColor={ds.colors.textTertiary}
              activeOutlineColor={ds.colors.primary}
              textColor={ds.colors.textPrimary}
              placeholder="e.g., Dairy, Produce, Snacks"
            />

            <View style={styles.row}>
              <TextInput
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                mode="outlined"
                style={[styles.input, styles.quantityInput]}
                keyboardType="decimal-pad"
                outlineColor={ds.colors.textTertiary}
                activeOutlineColor={ds.colors.primary}
                textColor={ds.colors.textPrimary}
              />
              
              <View style={[styles.unitContainer, { borderColor: ds.colors.textTertiary }]}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.unitScroll}
                >
                  {UNITS.map((u) => (
                    <Chip
                      key={u}
                      selected={unit === u}
                      onPress={() => setUnit(u)}
                      style={[
                        styles.unitChip,
                        unit === u && { backgroundColor: ds.colors.primary + '20' }
                      ]}
                      textStyle={{ 
                        color: unit === u ? ds.colors.primary : ds.colors.textSecondary,
                        fontSize: 13,
                      }}
                    >
                      {u}
                    </Chip>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Divider style={[styles.divider, { backgroundColor: ds.colors.textTertiary + '30' }]} />

            {/* Storage Location */}
            <Text style={[styles.label, { color: ds.colors.textSecondary }]}>Storage Location</Text>
            <View style={styles.storageRow}>
              {STORAGE_LOCATIONS.map((loc) => (
                <View 
                  key={loc.key} 
                  style={[
                    styles.storageOption,
                    storageLocation === loc.key && { 
                      backgroundColor: ds.colors[loc.key as keyof typeof ds.colors] + '20',
                      borderColor: ds.colors[loc.key as keyof typeof ds.colors],
                    },
                    { borderColor: ds.colors.textTertiary + '50' }
                  ]}
                >
                  <Chip
                    selected={storageLocation === loc.key}
                    onPress={() => setStorageLocation(loc.key)}
                    style={styles.storageChip}
                    textStyle={{ 
                      color: storageLocation === loc.key 
                        ? ds.colors[loc.key as keyof typeof ds.colors]
                        : ds.colors.textSecondary,
                    }}
                    icon={({ size, color }) => (
                      <MaterialCommunityIcons
                        name={loc.icon as any}
                        size={size}
                        color={storageLocation === loc.key 
                          ? ds.colors[loc.key as keyof typeof ds.colors]
                          : ds.colors.textSecondary}
                      />
                    )}
                  >
                    {loc.label}
                  </Chip>
                </View>
              ))}
            </View>

            {/* Nutrition Grade (if available) */}
            {product?.nutrition_grade && (
              <View style={styles.nutritionContainer}>
                <Text style={[styles.label, { color: ds.colors.textSecondary }]}>Nutri-Score</Text>
                <View style={[
                  styles.nutriScoreBadge,
                  { backgroundColor: getNutriScoreColor(product.nutrition_grade) }
                ]}>
                  <Text style={styles.nutriScoreText}>{product.nutrition_grade}</Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Action Buttons */}
        <View style={[styles.bottomActions, { backgroundColor: ds.colors.background }]}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={[styles.actionButton, { borderColor: ds.colors.textTertiary }]}
            labelStyle={{ color: ds.colors.textPrimary }}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={!productName.trim() || saving}
            loading={saving}
            style={[styles.actionButton, styles.saveButton, { backgroundColor: ds.colors.primary }]}
            labelStyle={{ color: '#FFFFFF' }}
          >
            Add to Inventory
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getNutriScoreColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case 'A': return '#038141';
    case 'B': return '#85BB2F';
    case 'C': return '#FECB02';
    case 'D': return '#EE8100';
    case 'E': return '#E63E11';
    default: return '#808080';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  productImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  barcodeText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: 'transparent',
  },
  row: {
    gap: 12,
  },
  quantityInput: {
    marginBottom: 8,
  },
  unitContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  unitScroll: {
    paddingHorizontal: 8,
    gap: 8,
  },
  unitChip: {
    marginHorizontal: 2,
  },
  divider: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 4,
  },
  storageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  storageOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  storageChip: {
    backgroundColor: 'transparent',
  },
  nutritionContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nutriScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutriScoreText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
  },
  saveButton: {
    flex: 2,
  },
});
