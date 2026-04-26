import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { returnBookToVendor } from '../api/wholeBookSale';
import api from '../api/client';

/**
 * Props:
 *   visible    — boolean
 *   bookId     — known book id (from SlotDetail). If null, modal will look up by barcode.
 *   prefilledStaticCode — optional, for prefilling input/visual context
 *   onCancel   — () => void
 *   onSuccess  — (result) => void
 */
export default function ReturnBookModal({
  visible,
  bookId,
  prefilledStaticCode,
  onCancel,
  onSuccess,
}) {
  const navigation = useNavigation();
  const [barcode, setBarcode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setBarcode('');
      setPin('');
    }
  }, [visible]);

  function handleScanCamera() {
    navigation.navigate('CameraScanner', {
      onScanned: (data) => setBarcode(data),
    });
  }

  async function resolveBookId(scannedBarcode) {
    if (bookId) return bookId;

    // Look up book by static_code (barcode minus last 3 digits)
    const staticCode = scannedBarcode.slice(0, -3);
    if (staticCode.length < 1) {
      throw {
        code: 'INVALID_BARCODE',
        message: 'Barcode is too short.',
      };
    }
    const { data } = await api.get('/books');
    const match = (data.books || []).find(
      (b) => b.static_code === staticCode && b.is_active
    );
    if (!match) {
      throw {
        code: 'BOOK_NOT_FOUND',
        message: 'No active book matches this barcode.',
      };
    }
    return match.book_id;
  }

  async function handleSubmit() {
    if (!barcode.trim()) {
      Alert.alert('Missing barcode', 'Scan or type the book barcode.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert('Invalid PIN', 'Store PIN must be exactly 4 digits.');
      return;
    }

    setBusy(true);
    try {
      const resolvedBookId = await resolveBookId(barcode.trim());
      const result = await returnBookToVendor(resolvedBookId, {
        barcode: barcode.trim(),
        pin,
      });
      onSuccess(result);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleError(err) {
    if (err.code === 'INVALID_PIN') {
      Alert.alert('Wrong PIN', 'The store PIN is incorrect.');
    } else if (err.code === 'PIN_LOCKOUT') {
      Alert.alert('Locked out', err.message || 'Too many failed PIN attempts.');
    } else if (err.code === 'BARCODE_MISMATCH') {
      Alert.alert(
        'Wrong barcode',
        'The scanned barcode does not match this book.'
      );
    } else if (err.code === 'BOOK_NOT_FOUND') {
      Alert.alert('Not found', 'No active book matches this barcode.');
    } else {
      Alert.alert(err.code || 'Error', err.message || 'Could not return book.');
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Return to Vendor</Text>
            <Text style={styles.subtitle}>
              Lottery salesman is removing this book. Pre-return revenue will be preserved.
            </Text>

            {prefilledStaticCode && (
              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>Returning</Text>
                <Text style={styles.contextValue}>{prefilledStaticCode}</Text>
              </View>
            )}

            <Text style={styles.label}>Barcode</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Scan or type"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.cameraButton} onPress={handleScanCamera}>
                <Text style={styles.cameraButtonText}>📷</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Store PIN</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                disabled={busy}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.submitButton, busy && styles.disabled]}
                onPress={handleSubmit}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Confirm Return</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '92%',
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 16 },

  contextCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  contextValue: { fontSize: 16, fontWeight: '700', color: '#78350f' },

  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  barcodeRow: { flexDirection: 'row', gap: 8 },
  barcodeInput: { flex: 1 },
  cameraButton: {
    paddingHorizontal: 16,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButtonText: { fontSize: 22 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelText: { color: '#444', fontWeight: '600' },
  submitButton: { backgroundColor: '#dc2626' },
  submitText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.6 },
});