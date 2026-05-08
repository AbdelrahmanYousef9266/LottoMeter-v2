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
import { useTranslation } from 'react-i18next';

import { returnBookToVendor } from '../api/wholeBookSale';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { normalizeBarcode } from '../utils/barcodeUtils';

export default function ReturnBookModal({
  visible,
  bookId,
  prefilledStaticCode,
  onCancel,
  onSuccess,
}) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { scanMode } = useAuth();
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
      onScanned: (data) => setBarcode(normalizeBarcode(data)),
    });
  }

  async function resolveBookId(normalizedBarcode) {
    if (bookId) return bookId;

    const staticCode = normalizedBarcode.slice(0, -3);
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
        message: t('returnBook.notFoundHint'),
      };
    }
    return match.book_id;
  }

  async function handleSubmit() {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) {
      Alert.alert(t('returnBook.missingBarcode'), t('returnBook.missingBarcodeHint'));
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert(t('returnBook.invalidPin'), t('returnBook.invalidPinHint'));
      return;
    }

    setBusy(true);
    try {
      const resolvedBookId = await resolveBookId(normalizedBarcode);
      const result = await returnBookToVendor(resolvedBookId, {
        barcode: normalizedBarcode,
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
      Alert.alert(t('returnBook.wrongPin'), t('returnBook.wrongPinHint'));
    } else if (err.code === 'PIN_LOCKOUT') {
      Alert.alert(t('returnBook.lockedOut'), err.message || t('returnBook.lockedOutHint'));
    } else if (err.code === 'BARCODE_MISMATCH') {
      Alert.alert(t('returnBook.wrongBarcode'), t('returnBook.wrongBarcodeHint'));
    } else if (err.code === 'BOOK_NOT_FOUND') {
      Alert.alert(t('returnBook.notFound'), t('returnBook.notFoundHint'));
    } else {
      Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
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
            <Text style={styles.title}>{t('returnBook.title')}</Text>
            <Text style={styles.subtitle}>{t('returnBook.subtitle')}</Text>

            {prefilledStaticCode && (
              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>{t('returnBook.returning')}</Text>
                <Text style={styles.contextValue}>{prefilledStaticCode}</Text>
              </View>
            )}

            <Text style={styles.label}>{t('returnBook.barcode')}</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                value={barcode}
                onChangeText={(text) => setBarcode(normalizeBarcode(text))}
                placeholder={t('returnBook.barcodePlaceholder')}
                autoCorrect={false}
                keyboardType="numeric"
                maxLength={14}
                autoFocus={scanMode === 'hardware_scanner'}
              />
              {scanMode !== 'hardware_scanner' && (
                <TouchableOpacity style={styles.cameraButton} onPress={handleScanCamera}>
                  <Text style={styles.cameraButtonText}>📷</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>{t('returnBook.storePin')}</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, 4))}
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
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.submitButton, busy && styles.disabled]}
                onPress={handleSubmit}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>{t('returnBook.confirmReturn')}</Text>
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