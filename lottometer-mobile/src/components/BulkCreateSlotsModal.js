import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { bulkCreateSlots } from '../api/slots';

const VALID_PRICES = ['1.00', '2.00', '3.00', '5.00', '10.00', '20.00'];

export default function BulkCreateSlotsModal({ visible, onClose, onCreated }) {
  const { t } = useTranslation();

  const [mode, setMode] = useState('quick'); // 'quick' | 'groups'
  const [quickCount, setQuickCount] = useState('10');
  const [quickPrice, setQuickPrice] = useState('5.00');
  const [groups, setGroups] = useState([
    { count: '10', price: '1.00' },
    { count: '10', price: '5.00' },
  ]);
  const [namePrefix, setNamePrefix] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setMode('quick');
    setQuickCount('10');
    setQuickPrice('5.00');
    setGroups([
      { count: '10', price: '1.00' },
      { count: '10', price: '5.00' },
    ]);
    setNamePrefix('');
  }

  function addGroup() {
    if (groups.length >= 10) return;
    setGroups([...groups, { count: '5', price: '5.00' }]);
  }

  function removeGroup(idx) {
    if (groups.length <= 1) return;
    setGroups(groups.filter((_, i) => i !== idx));
  }

  function updateGroup(idx, field, value) {
    setGroups(
      groups.map((g, i) => (i === idx ? { ...g, [field]: value } : g))
    );
  }

  async function handleCreate() {
    let tiers;
    if (mode === 'quick') {
      const n = parseInt(quickCount, 10);
      if (!Number.isFinite(n) || n < 1) {
        Alert.alert(t('bulkSlots.invalidCount'), t('bulkSlots.invalidCountHint'));
        return;
      }
      if (!VALID_PRICES.includes(quickPrice)) {
        Alert.alert(t('bulkSlots.invalidPrice'), t('bulkSlots.invalidPriceHint'));
        return;
      }
      tiers = [{ count: n, ticket_price: quickPrice }];
    } else {
      tiers = [];
      for (const g of groups) {
        const n = parseInt(g.count, 10);
        if (!Number.isFinite(n) || n < 1) {
          Alert.alert(t('bulkSlots.invalidCount'), t('bulkSlots.invalidCountHint'));
          return;
        }
        if (!VALID_PRICES.includes(g.price)) {
          Alert.alert(t('bulkSlots.invalidPrice'), t('bulkSlots.invalidPriceHint'));
          return;
        }
        tiers.push({ count: n, ticket_price: g.price });
      }
    }

    const total = tiers.reduce((sum, t) => sum + t.count, 0);
    if (total > 500) {
      Alert.alert(t('bulkSlots.tooMany'), t('bulkSlots.tooManyHint', { total }));
      return;
    }

    setBusy(true);
    try {
      const result = await bulkCreateSlots({
        tiers,
        name_prefix: namePrefix.trim() || undefined,
      });
      Alert.alert(
        t('bulkSlots.successTitle'),
        t('bulkSlots.successHint', { count: result.created_count })
      );
      reset();
      onCreated();
    } catch (err) {
      Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  const totalSlots =
    mode === 'quick'
      ? parseInt(quickCount, 10) || 0
      : groups.reduce((sum, g) => sum + (parseInt(g.count, 10) || 0), 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{t('bulkSlots.title')}</Text>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'quick' && styles.modeButtonActive]}
                onPress={() => setMode('quick')}
              >
                <Text
                  style={[styles.modeText, mode === 'quick' && styles.modeTextActive]}
                >
                  {t('bulkSlots.modeQuick')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === 'groups' && styles.modeButtonActive]}
                onPress={() => setMode('groups')}
              >
                <Text
                  style={[styles.modeText, mode === 'groups' && styles.modeTextActive]}
                >
                  {t('bulkSlots.modeGroups')}
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'quick' ? (
              <View>
                <Text style={styles.helperText}>{t('bulkSlots.quickHint')}</Text>

                <Text style={styles.label}>{t('bulkSlots.howMany')}</Text>
                <TextInput
                  style={styles.input}
                  value={quickCount}
                  onChangeText={(text) => setQuickCount(text.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="10"
                />

                <Text style={styles.label}>{t('bulkSlots.atPrice')}</Text>
                <View style={styles.priceGrid}>
                  {VALID_PRICES.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priceOption,
                        quickPrice === p && styles.priceOptionActive,
                      ]}
                      onPress={() => setQuickPrice(p)}
                    >
                      <Text
                        style={[
                          styles.priceOptionText,
                          quickPrice === p && styles.priceOptionTextActive,
                        ]}
                      >
                        ${p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.helperText}>{t('bulkSlots.groupsHint')}</Text>

                {groups.map((g, idx) => (
                  <View key={idx} style={styles.groupRow}>
                    <View style={styles.groupCountWrap}>
                      <Text style={styles.smallLabel}>{t('bulkSlots.count')}</Text>
                      <TextInput
                        style={styles.smallInput}
                        value={g.count}
                        onChangeText={(text) =>
                          updateGroup(idx, 'count', text.replace(/\D/g, ''))
                        }
                        keyboardType="number-pad"
                      />
                    </View>

                    <View style={styles.groupPriceWrap}>
                      <Text style={styles.smallLabel}>{t('bulkSlots.price')}</Text>
                      <View style={styles.priceMiniGrid}>
                        {VALID_PRICES.map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[
                              styles.priceMini,
                              g.price === p && styles.priceMiniActive,
                            ]}
                            onPress={() => updateGroup(idx, 'price', p)}
                          >
                            <Text
                              style={[
                                styles.priceMiniText,
                                g.price === p && styles.priceMiniTextActive,
                              ]}
                            >
                              ${p}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {groups.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeGroup(idx)}
                        style={styles.removeGroupBtn}
                      >
                        <Text style={styles.removeGroupText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {groups.length < 10 && (
                  <TouchableOpacity style={styles.addGroupBtn} onPress={addGroup}>
                    <Text style={styles.addGroupText}>{t('bulkSlots.addTier')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.label}>{t('bulkSlots.namePrefix')}</Text>
            <Text style={styles.helperText}>{t('bulkSlots.namePrefixHint')}</Text>
            <TextInput
              style={styles.input}
              value={namePrefix}
              onChangeText={setNamePrefix}
              placeholder={t('bulkSlots.namePrefixPlaceholder')}
              autoCapitalize="words"
            />

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>{t('bulkSlots.totalLabel')}</Text>
              <Text style={styles.previewValue}>
                {t('bulkSlots.totalValue', { count: totalSlots })}
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  reset();
                  onClose();
                }}
                disabled={busy}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  (busy || totalSlots === 0) && styles.disabled,
                ]}
                onPress={handleCreate}
                disabled={busy || totalSlots === 0}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {t('bulkSlots.createButton', { count: totalSlots })}
                  </Text>
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
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: '#1a73e8',
    backgroundColor: '#e8f0fe',
  },
  modeText: { color: '#666', fontWeight: '600' },
  modeTextActive: { color: '#1a73e8' },

  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '600',
  },
  smallLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  helperText: { fontSize: 12, color: '#888', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  smallInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    backgroundColor: '#fafafa',
    textAlign: 'center',
  },

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

  groupRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  groupCountWrap: { width: 70 },
  groupPriceWrap: { flex: 1 },
  priceMiniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  priceMini: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  priceMiniActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  priceMiniText: { color: '#666', fontWeight: '600', fontSize: 12 },
  priceMiniTextActive: { color: '#1a73e8' },
  removeGroupBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGroupText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },

  addGroupBtn: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
    alignItems: 'center',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addGroupText: { color: '#1a73e8', fontWeight: '600' },

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
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  previewValue: { fontSize: 18, fontWeight: '700', color: '#1a73e8' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelText: { color: '#444', fontWeight: '600' },
  submitButton: { backgroundColor: '#1a73e8' },
  submitText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});