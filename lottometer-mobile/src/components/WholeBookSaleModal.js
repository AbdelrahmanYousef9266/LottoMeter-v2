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

import { recordWholeBookSale } from '../api/wholeBookSale';
import { useAuth } from '../context/AuthContext';
import { normalizeBarcode } from '../utils/barcodeUtils';

const VALID_PRICES = ['1.00', '2.00', '3.00', '5.00', '10.00', '20.00'];

const LENGTH_BY_PRICE = {
  '1.00': 150,
  '2.00': 150,
  '3.00': 100,
  '5.00': 60,
  '10.00': 30,
  '20.00': 30,
};

export default function WholeBookSaleModal({ visible, subshiftId, onCancel, onSuccess }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { scanMode } = useAuth();
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('5.00');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setBarcode('');
      setPrice('5.00');
      setPin('');
    }
  }, [visible]);

  function handleScanCamera() {
    navigation.navigate('CameraScanner', {
      onScanned: (data) => setBarcode(normalizeBarcode(data)),
    });
  }

  async function handleSubmit() {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) {
      Alert.alert(t('wholeBook.missingBarcode'), t('wholeBook.missingBarcodeHint'));
      return;
    }
    if (!VALID_PRICES.includes(price)) {
      Alert.alert(t('wholeBook.invalidPrice'), t('wholeBook.invalidPriceHint'));
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert(t('wholeBook.invalidPin'), t('wholeBook.invalidPinHint'));
      return;
    }

    setBusy(true);
    try {
      const result = await recordWholeBookSale(subshiftId, {
        barcode: normalizedBarcode,
        ticket_price: price,
        pin,
      });
      onSuccess(result.extra_sale);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleError(err) {
    if (err.code === 'INVALID_PIN') {
      Alert.alert(t('wholeBook.wrongPin'), t('wholeBook.wrongPinHint'));
    } else if (err.code === 'PIN_LOCKOUT') {
      Alert.alert(t('wholeBook.lockedOut'), err.message || t('wholeBook.lockedOutHint'));
    } else if (err.code === 'PIN_NOT_CONFIGURED') {
      Alert.alert(t('wholeBook.pinNotSet'), t('wholeBook.pinNotSetHint'));
    } else {
      Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
    }
  }

  const ticketCount = LENGTH_BY_PRICE[price] || 0;
  const value = ticketCount * (parseFloat(price) || 0);

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
            <Text style={styles.title}>{t('wholeBook.title')}</Text>
            <Text style={styles.subtitle}>{t('wholeBook.subtitle')}</Text>

            <Text style={styles.label}>{t('wholeBook.barcode')}</Text>
            <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, styles.barcodeInput]}
                  value={barcode}
                  onChangeText={(text) => setBarcode(normalizeBarcode(text))}
                  placeholder={t('wholeBook.barcodePlaceholder')}
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

            <Text style={styles.label}>{t('wholeBook.ticketPrice')}</Text>
            <View style={styles.priceGrid}>
              {VALID_PRICES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priceOption, price === p && styles.priceOptionActive]}
                  onPress={() => setPrice(p)}
                >
                  <Text
                    style={[
                      styles.priceOptionText,
                      price === p && styles.priceOptionTextActive,
                    ]}
                  >
                    ${p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>{t('wholeBook.thisSale')}</Text>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>{t('wholeBook.tickets')}</Text>
                <Text style={styles.kvValue}>{ticketCount}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>{t('wholeBook.value')}</Text>
                <Text style={styles.kvValue}>${value.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.label}>{t('wholeBook.storePin')}</Text>
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
                  <Text style={styles.submitText}>{t('wholeBook.confirmSale')}</Text>
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

  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  priceOptionActive: {
    borderColor: '#1a73e8',
    backgroundColor: '#e8f0fe',
  },
  priceOptionText: { color: '#666', fontWeight: '600' },
  priceOptionTextActive: { color: '#1a73e8' },

  previewCard: {
    backgroundColor: '#f4f5f7',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvKey: { color: '#666', fontSize: 14 },
  kvValue: { color: '#222', fontSize: 14, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelText: { color: '#444', fontWeight: '600' },
  submitButton: { backgroundColor: '#1a73e8' },
  submitText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.6 },
});