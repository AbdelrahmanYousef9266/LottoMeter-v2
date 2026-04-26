import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScannerScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const onScanned = route.params?.onScanned;
  const lockRef = useRef(false);

  function handleBarCodeScanned({ data }) {
    if (lockRef.current) return;
    lockRef.current = true;
    setScanned(true);
    Vibration.vibrate(60);

    // Pass the barcode back to the previous screen
    if (typeof onScanned === 'function') {
      onScanned(data);
    }
    navigation.goBack();
  }

  if (!permission) {
    // Permission state still loading
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.permTitle}>Camera permission required</Text>
          <Text style={styles.permText}>
            We need access to the camera to scan barcodes.
          </Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.permButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.permButton, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code39',
            'code93',
            'code128',
            'codabar',
            'itf14',
            'pdf417',
            'qr',
          ],
        }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.targetBox} />
        <Text style={styles.hint}>Point camera at the barcode</Text>
      </View>

      <SafeAreaView style={styles.bottom} edges={['bottom']}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  permTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  permText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  permButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  permButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: '#333' },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBox: {
    width: 280,
    height: 160,
    borderWidth: 3,
    borderColor: '#1a73e8',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});