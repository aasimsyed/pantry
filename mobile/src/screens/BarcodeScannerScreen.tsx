import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getDesignSystem } from '../utils/designSystem';
import apiClient from '../api/client';

/** Barcode types for product scanning. On iOS, omit barcodeScannerSettings to avoid AVCaptureSession crash (use defaults). */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.75;

type RouteParams = {
  BarcodeScanner: {
    pantryId?: number;
    storageLocation?: 'pantry' | 'fridge' | 'freezer';
  };
};

export default function BarcodeScannerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'BarcodeScanner'>>();
  const { isDark } = useTheme();
  const ds = getDesignSystem(isDark);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const { pantryId, storageLocation = 'pantry' } = route.params || {};

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // On iOS, delay mounting CameraView to avoid AVCaptureSession "startRunning between beginConfiguration and commitConfiguration" crash
  useEffect(() => {
    if (!permission?.granted) {
      setCameraReady(false);
      return;
    }
    if (Platform.OS === 'ios') {
      const t = setTimeout(() => setCameraReady(true), 150);
      return () => clearTimeout(t);
    }
    setCameraReady(true);
  }, [permission?.granted]);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    const data = result?.data;
    if (typeof data !== 'string' || !data.trim() || scanned || loading || data === lastScannedRef.current) return;

    lastScannedRef.current = data;
    setScanned(true);
    setLoading(true);

    try {
      const product = await apiClient.lookupBarcode(data);
      navigation.navigate('ProductConfirm' as never, {
        product,
        barcode: data,
        pantryId,
        storageLocation,
      } as never);
    } catch (error: any) {
      if (error.response?.status === 404) {
        navigation.navigate('ProductConfirm' as never, {
          product: null,
          barcode: data,
          pantryId,
          storageLocation,
        } as never);
      } else {
        Alert.alert(
          'Scan Error',
          error.message || 'Failed to look up product',
          [
            { text: 'Try Again', onPress: () => resetScanner() },
            { text: 'Enter Manually', onPress: () => {
              navigation.navigate('ProductConfirm' as never, {
                product: null,
                barcode: data,
                pantryId,
                storageLocation,
              } as never);
            }},
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    lastScannedRef.current = null;
  };

  // Permission loading state
  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ds.colors.primary} />
          <Text style={{ color: ds.colors.textPrimary, marginTop: 16 }}>
            Requesting camera permission...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Permission denied state
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="camera-off" size={64} color={ds.colors.textSecondary} />
          <Text style={[styles.permissionTitle, { color: ds.colors.textPrimary }]}>
            Camera Permission Required
          </Text>
          <Text style={[styles.permissionText, { color: ds.colors.textSecondary }]}>
            Please allow camera access to scan barcodes
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: ds.colors.primary }]}
            onPress={requestPermission}
            accessibilityLabel="Grant camera permission"
            accessibilityHint="Double tap to open settings"
            accessibilityRole="button"
          >
            <Text style={[styles.permissionButtonText, { color: ds.colors.textInverse }]}>
              Grant Permission
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Cancel"
            accessibilityHint="Double tap to go back"
            accessibilityRole="button"
          >
            <Text style={{ color: ds.colors.primary, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Camera mount error (e.g. iOS AVCaptureSession crash) — show message instead of crashing
  if (mountError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="camera-off" size={64} color={ds.colors.textSecondary} />
          <Text style={[styles.permissionTitle, { color: ds.colors.textPrimary }]}>
            Camera unavailable
          </Text>
          <Text style={[styles.permissionText, { color: ds.colors.textSecondary }]}>
            {mountError}
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: ds.colors.primary }]}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityHint="Double tap to exit and return to inventory"
            accessibilityRole="button"
          >
            <Text style={[styles.permissionButtonText, { color: ds.colors.textInverse }]}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Delay showing CameraView on iOS to avoid native session config race
  if (!cameraReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: ds.colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ds.colors.primary} />
          <Text style={{ color: ds.colors.textPrimary, marginTop: 16 }}>
            Starting camera...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // On iOS, omit barcodeScannerSettings to avoid "startRunning between beginConfiguration and commitConfiguration" crash; defaults still scan common types
  const barcodeSettings = Platform.OS === 'ios'
    ? undefined
    : { barcodeTypes: [...BARCODE_TYPES] };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={barcodeSettings}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        onMountError={({ message }) => setMountError(message || 'Camera could not start')}
      />
      
      {/* Scan Frame Overlay */}
      <View style={styles.overlay} pointerEvents="none">
        {/* Top dark area */}
        <View style={styles.overlayTop} />
        
        {/* Middle row with scan area */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Looking up product...</Text>
              </View>
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>
        
        {/* Bottom dark area with instructions */}
        <View style={styles.overlayBottomText}>
          <Text style={styles.instructionText}>
            Point camera at barcode
          </Text>
        </View>
      </View>

      {/* Bottom Control Bar - Easy to reach with thumb */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.controlsRow}>
          {/* Flashlight toggle */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setTorch(!torch)}
            activeOpacity={0.7}
            accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
            accessibilityHint="Double tap to toggle flashlight"
            accessibilityRole="button"
          >
            <View style={[styles.controlButtonInner, torch && styles.controlButtonActive]}>
              <MaterialCommunityIcons 
                name={torch ? 'flashlight' : 'flashlight-off'} 
                size={28} 
                color={torch ? '#000' : '#FFF'} 
              />
            </View>
            <Text style={styles.controlLabel}>{torch ? 'Light On' : 'Light'}</Text>
          </TouchableOpacity>

          {/* Cancel button - Large and prominent */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Cancel scan"
            accessibilityHint="Double tap to exit scanner"
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          {/* Rescan button (or placeholder) */}
          {scanned && !loading ? (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={resetScanner}
              activeOpacity={0.7}
              accessibilityLabel="Rescan barcode"
              accessibilityHint="Double tap to scan again"
              accessibilityRole="button"
            >
              <View style={styles.controlButtonInner}>
                <MaterialCommunityIcons name="refresh" size={28} color="#FFF" />
              </View>
              <Text style={styles.controlLabel}>Rescan</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.controlButton}>
              <View style={[styles.controlButtonInner, styles.controlButtonPlaceholder]} />
              <Text style={[styles.controlLabel, { opacity: 0 }]}>Rescan</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelLink: {
    marginTop: 20,
    padding: 12,
  },
  
  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_AREA_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  overlayBottomText: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingTop: 24,
    paddingBottom: 140, // Space for bottom controls
    alignItems: 'center',
  },
  
  // Scan area
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Bottom control bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'android' ? 24 : 8,
  },
  controlButton: {
    alignItems: 'center',
    width: 70,
  },
  controlButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#FFD60A',
  },
  controlButtonPlaceholder: {
    opacity: 0,
  },
  controlLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
