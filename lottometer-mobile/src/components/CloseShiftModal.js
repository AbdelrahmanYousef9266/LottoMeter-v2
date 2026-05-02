import React, { useState, useEffect, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';

import { getSubshiftSummary } from '../api/shifts';
import { useFeedback } from '../hooks/useFeedback';

export default function CloseShiftModal({
  visible,
  mode,
  mainShiftId,
  subshiftId,
  onCancel,
  onSubmit,
  closedSubshiftCount = 0,
  voidedSubshiftCount = 0,
}) {
  const { t } = useTranslation();
  const fireFeedback = useFeedback();

  const [cashInHand, setCashInHand] = useState('');
  const [grossSales, setGrossSales] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [cancels, setCancels] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setCashInHand('');
      setGrossSales('');
      setCashOut('');
      setCancels('');
      setConfirmingClose(false);
      loadSummary();
    }
  }, [visible]);

  const loadSummary = useCallback(async () => {
    if (!subshiftId) return;
    setSummaryLoading(true);
    try {
      const data = await getSubshiftSummary(subshiftId);
      setSummary(data);
    } catch (err) {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [subshiftId]);

  const ticketsTotal = parseFloat(summary?.tickets_total || '0') || 0;
  const grossSalesNum = parseFloat(grossSales) || 0;
  const cashOutNum = parseFloat(cashOut) || 0;
  const cancelsNum = parseFloat(cancels) || 0;
  const cashInHandNum = parseFloat(cashInHand) || 0;
  const expectedCash = grossSalesNum + ticketsTotal - cashOutNum - cancelsNum;
  const difference = cashInHandNum - expectedCash;

  let status = '—';
  let statusColor = '#888';
  let statusBgColor = '#f0f0f0';
  if (cashInHand) {
    if (Math.abs(difference) < 0.005) {
      status = t('closeShift.statusCorrect');
      statusColor = '#16a34a';
      statusBgColor = '#dcfce7';
    } else if (difference > 0) {
      status = t('closeShift.statusOver');
      statusColor = '#d97706';
      statusBgColor = '#fef9c3';
    } else {
      status = t('closeShift.statusShort');
      statusColor = '#dc2626';
      statusBgColor = '#fef2f2';
    }
  }

  const booksPending = summary?.books_pending_close ?? 0;
  const blockedByPendingCloses = booksPending > 0;

  const isHandover = mode === 'handover';
  const titleText = isHandover ? t('closeShift.handoverTitle') : t('closeShift.finalTitle');
  const submitText = isHandover ? t('closeShift.endSubshift') : t('closeShift.endMainShift');

  async function doClose() {
    setBusy(true);
    try {
      await onSubmit({
        cash_in_hand: cashInHand,
        gross_sales: grossSales,
        cash_out: cashOut,
        cancels: cancels || '0',
      });
      fireFeedback('shift_closed');
    } catch (err) {
      fireFeedback('error');
    } finally {
      setBusy(false);
      setConfirmingClose(false);
    }
  }

  async function handleSubmit() {
    if (cashInHand === '' || grossSales === '' || cashOut === '') {
      Alert.alert(t('closeShift.missingValues'), t('closeShift.missingValuesHint'));
      return;
    }
    if (cashInHandNum < 0 || grossSalesNum < 0 || cashOutNum < 0 || cancelsNum < 0) {
      Alert.alert(t('closeShift.invalidValues'), t('closeShift.invalidValuesHint'));
      return;
    }

    if (isHandover) {
      const diffText = difference >= 0
        ? `+$${difference.toFixed(2)}`
        : `-$${Math.abs(difference).toFixed(2)}`;
      Alert.alert(
        t('closeShift.confirmHandoverTitle'),
        t('closeShift.confirmHandoverBody', { status, diff: diffText }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('closeShift.endSubshift'), onPress: doClose },
        ]
      );
    } else {
      setConfirmingClose(true);
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
            {confirmingClose ? (
              <>
                <Text style={styles.title}>{t('closeShift.confirmFinalTitle')}</Text>
                <Text style={styles.confirmSubtitle}>{t('closeShift.confirmFinalSubtitle')}</Text>

                <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{status}</Text>
                </View>

                <View style={styles.previewCard}>
                  <KV k={t('closeShift.ticketsTotal')} v={`$${ticketsTotal.toFixed(2)}`} />
                  {cancelsNum > 0 && (
                    <KV k={t('closeShift.cancels')} v={`$${cancelsNum.toFixed(2)}`} />
                  )}
                  <KV k={t('closeShift.expectedCash')} v={`$${expectedCash.toFixed(2)}`} />
                  <KV
                    k={t('closeShift.difference')}
                    v={`$${difference.toFixed(2)}`}
                    vColor={statusColor}
                  />
                </View>

                <Text style={styles.confirmInfoText}>
                  {t('closeShift.confirmFinalInfo', {
                    closed: closedSubshiftCount,
                    voided: voidedSubshiftCount,
                  })}
                </Text>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setConfirmingClose(false)}
                    disabled={busy}
                  >
                    <Text style={styles.cancelText}>{t('common.back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.submitButton,
                      busy && styles.disabled,
                    ]}
                    onPress={doClose}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>{t('closeShift.endMainShift')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>{titleText}</Text>

                {summaryLoading ? (
                  <View style={styles.banner}>
                    <ActivityIndicator />
                  </View>
                ) : blockedByPendingCloses ? (
                  <View style={[styles.banner, styles.bannerError]}>
                    <Text style={styles.bannerErrorText}>
                      {t('closeShift.pendingClosesWarning', { count: booksPending })}
                    </Text>
                    <Text style={styles.bannerErrorHint}>
                      {t('closeShift.pendingClosesHint')}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.banner, styles.bannerOk]}>
                    <Text style={styles.bannerOkText}>{t('closeShift.allBooksClosed')}</Text>
                  </View>
                )}

                <Text style={styles.label}>{t('closeShift.cashInHand')}</Text>
                <TextInput
                  style={styles.input}
                  value={cashInHand}
                  onChangeText={setCashInHand}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>{t('closeShift.grossSales')}</Text>
                <TextInput
                  style={styles.input}
                  value={grossSales}
                  onChangeText={setGrossSales}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>{t('closeShift.cashOut')}</Text>
                <TextInput
                  style={styles.input}
                  value={cashOut}
                  onChangeText={setCashOut}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>{t('closeShift.cancels')}</Text>
                <TextInput
                  style={styles.input}
                  value={cancels}
                  onChangeText={setCancels}
                  placeholder={t('closeShift.cancelsPlaceholder')}
                  keyboardType="decimal-pad"
                />

                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>{t('closeShift.livePreview')}</Text>
                  <KV k={t('closeShift.ticketsTotal')} v={`$${ticketsTotal.toFixed(2)}`} />
                  {cancelsNum > 0 && (
                    <KV k={t('closeShift.cancels')} v={`$${cancelsNum.toFixed(2)}`} />
                  )}
                  <KV k={t('closeShift.expectedCash')} v={`$${expectedCash.toFixed(2)}`} />
                  <KV
                    k={t('closeShift.difference')}
                    v={`$${difference.toFixed(2)}`}
                    vColor={statusColor}
                  />
                  <KV k={t('closeShift.status')} v={status} vColor={statusColor} />
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={onCancel}
                    disabled={busy}
                  >
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.submitButton,
                      (busy || blockedByPendingCloses) && styles.disabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={busy || blockedByPendingCloses}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>{submitText}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function KV({ k, v, vColor }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvValue, vColor && { color: vColor }]}>{v}</Text>
    </View>
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
    maxHeight: '90%',
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },

  banner: { borderRadius: 8, padding: 12, marginBottom: 16 },
  bannerError: { backgroundColor: '#fef2f2' },
  bannerErrorText: { color: '#dc2626', fontWeight: '600', marginBottom: 4 },
  bannerErrorHint: { color: '#7f1d1d', fontSize: 12 },
  bannerOk: { backgroundColor: '#dcfce7' },
  bannerOkText: { color: '#166534', fontWeight: '600' },

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

  previewCard: {
    backgroundColor: '#f4f5f7',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginBottom: 10,
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
  disabled: { opacity: 0.5 },

  confirmSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
  confirmInfoText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
  },
  statusBadgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});