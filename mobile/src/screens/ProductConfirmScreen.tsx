import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Image, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import apiClient from '../api/client';
import { triggerHapticSuccess } from '../utils/haptics';
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

      triggerHapticSuccess();
      // BarcodeScanner used replace(), so stack is [Main, ProductConfirm]; one goBack() returns to Inventory
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving product:', error);
      navigation.goBack();
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
          {/* Product Image - Minimal */}
          {product?.image_url && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: product.image_url }}
                style={styles.productImage}
                resizeMode="contain"
                accessibilityLabel={product?.product_name ?? 'Product image'}
                accessibilityHint="Product photo"
                accessibilityRole="image"
                accessibilityIgnoresInvertColors
              />
            </View>
          )}

          {/* Status - Minimal text */}
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: ds.colors.textSecondary }]}>
              {isNotFound 
                ? 'Product not found in database'
                : product?.found_in_database 
                  ? 'Found in your database'
                  : 'Found via Open Food Facts'}
            </Text>
          </View>

          {/* Barcode - Clean display */}
          <View style={[styles.barcodeContainer, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <Text style={[styles.barcodeLabel, { color: ds.colors.textTertiary }]}>
              BARCODE
            </Text>
            <Text style={[styles.barcodeValue, { color: ds.colors.textPrimary }]}>
              {barcode}
            </Text>
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
              accessibilityLabel="Product name"
              accessibilityHint="Enter product name"
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
              accessibilityLabel="Brand"
              accessibilityHint="Enter brand"
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
              accessibilityLabel="Category"
              accessibilityHint="Enter category"
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
                accessibilityLabel="Quantity"
                accessibilityHint="Enter quantity"
              />
              
              <View style={styles.unitContainer}>
                <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>UNIT</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.unitScroll}
                >
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      style={[
                        styles.unitOption,
                        { 
                          borderColor: unit === u 
                            ? ds.colors.textPrimary 
                            : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                        }
                      ]}
                      accessibilityLabel={u}
                      accessibilityHint={unit === u ? 'Selected' : 'Double tap to select unit'}
                      accessibilityRole="button"
                    >
                      <Text style={[
                        styles.unitText,
                        { color: unit === u ? ds.colors.textPrimary : ds.colors.textSecondary },
                        unit === u && { fontWeight: '500' }
                      ]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]} />

            {/* Storage Location - Minimal */}
            <View style={styles.formSection}>
              <Text style={[styles.fieldLabel, { color: ds.colors.textTertiary }]}>
                STORAGE LOCATION
              </Text>
              <View style={styles.optionButtons}>
                {STORAGE_LOCATIONS.map((loc) => (
                  <TouchableOpacity
                    key={loc.key}
                    onPress={() => setStorageLocation(loc.key)}
                    style={[
                      styles.optionButton,
                      { 
                        borderColor: storageLocation === loc.key 
                          ? ds.colors.textPrimary 
                          : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'
                      }
                    ]}
                    accessibilityLabel={loc.label}
                    accessibilityHint={storageLocation === loc.key ? 'Selected' : 'Double tap to select storage location'}
                    accessibilityRole="button"
                  >
                    <Text style={[
                      styles.optionButtonText,
                      { color: storageLocation === loc.key ? ds.colors.textPrimary : ds.colors.textSecondary },
                      storageLocation === loc.key && { fontWeight: '500' }
                    ]}>
                      {loc.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 100,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  productImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
    letterSpacing: -0.1,
  },
  barcodeContainer: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
  },
  barcodeLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.55,
  },
  barcodeValue: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  form: {
    gap: 20,
  },
  input: {
    backgroundColor: 'transparent',
  },
  row: {
    gap: 20,
  },
  quantityInput: {
    flex: 1,
  },
  unitContainer: {
    flex: 2,
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.55,
  },
  unitScroll: {
    gap: 8,
  },
  unitOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  unitText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  formSection: {
    // Clean section spacing
  },
  optionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
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
    padding: 20,
    paddingHorizontal: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 0,
  },
  saveButton: {
    flex: 2,
    elevation: 0,
  },
});
