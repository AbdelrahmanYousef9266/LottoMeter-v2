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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { getSubshiftSummary, closeShift } from '../api/shifts';
import { useFeedback } from '../hooks/useFeedback';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../offline/db';
import { closeOfflineShift, getOfflineShiftSummary } from '../offline';

// ── design tokens ─────────────────────────────────────────────────────────────
const D = {
  PRIMARY:    '#0077CC',
  SUCCESS:    '#16A34A',
  ERROR:      '#DC2626',
  WARNING:    '#D97706',
  BACKGROUND: '#F8FAFC',
  CARD:       '#FFFFFF',
  TEXT:       '#0F172A',
  SUBTLE:     '#64748B',
  BORDER:     '#E2E8F0',
};
const FS = { xs: 11, sm: 13, md: 15, lg: 18, xl: 22 };
const FW = { medium: '500', semibold: '600', bold: '700' };
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const BR = { sm: 6, md: 10, lg: 14, full: 999 };
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
};

export default function CloseShiftModal({
  visible,
  mode,
  mainShiftId,
  subshiftId,
  shiftUuid,
  onCancel,
  onSubmit,
  closedSubshiftCount = 0,
  voidedSubshiftCount = 0,
}) {
  const { t } = useTranslation();
  const fireFeedback = useFeedback();
  const { isOffline, user, store } = useAuth();

  const [cashInHand, setCashInHand] = useState('');
  const [grossSales, setGrossSales] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [cancels, setCancels] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

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
    if (!subshiftId && !shiftUuid) return;
    setSummaryLoading(true);
    try {
      if (isOffline) {
        // OFFLINE PATH — resolve shift UUID then query local DB
        let resolvedUuid = shiftUuid;
        if (!resolvedUuid) {
          const db = await getDb();
          const row = subshiftId
            ? await db.getFirstAsync(
                'SELECT uuid FROM local_employee_shifts WHERE server_id = ?',
                [subshiftId]
              )
            : await db.getFirstAsync(
                `SELECT uuid FROM local_employee_shifts
                 WHERE store_id = ? AND status = 'open'
                 ORDER BY id DESC LIMIT 1`,
                [store?.store_id]
              );
          resolvedUuid = row?.uuid;
        }
        if (resolvedUuid) {
          const data = await getOfflineShiftSummary(resolvedUuid, store?.store_id);
          setSummary(data);
        }
      } else {
        // ONLINE PATH — unchanged
        const data = await getSubshiftSummary(subshiftId);
        setSummary(data);
      }
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [subshiftId, shiftUuid, isOffline, store]);

  // ── calculations (unchanged) ───────────────────────────────────────────────

  const ticketsTotal = parseFloat(summary?.tickets_total || '0') || 0;
  const grossSalesNum = parseFloat(grossSales) || 0;
  const cashOutNum = parseFloat(cashOut) || 0;
  const cancelsNum = parseFloat(cancels) || 0;
  const cashInHandNum = parseFloat(cashInHand) || 0;
  const expectedCash = grossSalesNum + ticketsTotal - cashOutNum - cancelsNum;
  const difference = cashInHandNum - expectedCash;

  // Legacy status vars — kept for handleSubmit Alert
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

  // ── live display state ─────────────────────────────────────────────────────

  const hasInput = cashInHand !== '';
  const isExact = hasInput && Math.abs(difference) < 0.005;
  const isOver  = hasInput && difference > 0.005;
  const isShort = hasInput && difference < -0.005;

  const barColor     = !hasInput ? D.BORDER : isExact ? D.SUCCESS : isOver ? D.WARNING : D.ERROR;
  const diffBg       = !hasInput ? D.BACKGROUND : isExact ? '#F0FDF4' : isOver ? '#FFFBEB' : '#FEF2F2';
  const diffColor    = !hasInput ? D.SUBTLE : isExact ? D.SUCCESS : isOver ? D.WARNING : D.ERROR;
  const diffAmount   = !hasInput ? '—'
    : isExact ? '$0.00'
    : isOver  ? `+$${difference.toFixed(2)}`
    :           `-$${Math.abs(difference).toFixed(2)}`;

  const pillLabel = !hasInput   ? 'Enter values below'
    : isExact ? '✓ Correct'
    : isShort ? `✗ Short $${Math.abs(difference).toFixed(2)}`
    :           `↑ Over $${difference.toFixed(2)}`;
  const pillColor = !hasInput ? D.SUBTLE : isExact ? D.SUCCESS : isOver ? D.WARNING : D.ERROR;
  const pillBg    = !hasInput ? D.BORDER : isExact ? '#DCFCE7' : isOver ? '#FEF9C3' : '#FEE2E2';

  const booksPending = summary?.books_pending_close ?? 0;
  const blockedByPendingCloses = booksPending > 0;

  const isHandover = mode === 'handover';
  const submitText = isHandover ? t('closeShift.endSubshift') : t('closeShift.endMainShift');
  const isSubmitDisabled = !cashInHand || !grossSales || !cashOut || !cancels || busy || blockedByPendingCloses;
  const submitBg = isSubmitDisabled ? D.BORDER : isExact ? D.SUCCESS : D.PRIMARY;

  // ── logic (unchanged) ──────────────────────────────────────────────────────

  async function doClose() {
    setBusy(true);
    try {
      if (isOffline) {
        // OFFLINE PATH — close locally without going through onSubmit API call
        let resolvedUuid = shiftUuid;
        if (!resolvedUuid) {
          const db = await getDb();
          const row = subshiftId
            ? await db.getFirstAsync(
                'SELECT uuid FROM local_employee_shifts WHERE server_id = ?',
                [subshiftId]
              )
            : await db.getFirstAsync(
                `SELECT uuid FROM local_employee_shifts
                 WHERE store_id = ? AND status = 'open'
                 ORDER BY id DESC LIMIT 1`,
                [store?.store_id]
              );
          resolvedUuid = row?.uuid;
        }
        const result = await closeOfflineShift({
          store_id: store?.store_id,
          shift_uuid: resolvedUuid,
          shift_server_id: subshiftId,
          user_id: user?.user_id,
          cash_in_hand: cashInHand,
          gross_sales: grossSales,
          cash_out: cashOut,
          cancels: cancels || '0',
        });
        await onSubmit(result);
        fireFeedback('shift_closed');
      } else {
        // ONLINE PATH — call close API then notify parent
        const res = await closeShift(subshiftId, {
          cash_in_hand: cashInHand,
          gross_sales: grossSales,
          cash_out: cashOut,
          cancels: cancels || '0',
        });
        await onSubmit(res);
        fireFeedback('shift_closed');
      }
    } catch (err) {
      fireFeedback('error');
    } finally {
      setBusy(false);
      setConfirmingClose(false);
    }
  }

  async function handleSubmit() {
    if (cashInHand === '' || grossSales === '' || cashOut === '' || cancels === '') {
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

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.flex}
        >

          {/* ── HEADER ──────────────────────────────────────────────────────── */}
          <View style={s.header}>
            <TouchableOpacity
              style={s.headerClose}
              onPress={confirmingClose ? () => setConfirmingClose(false) : onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.headerCloseIcon}>✕</Text>
            </TouchableOpacity>

            <Text style={s.headerTitle}>
              {confirmingClose ? 'Confirm Close' : 'Close Shift'}
            </Text>

            {subshiftId ? (
              <View style={s.shiftBadge}>
                <Text style={s.shiftBadgeText}>Shift #{subshiftId}</Text>
              </View>
            ) : (
              <View style={s.headerSpacer} />
            )}
          </View>

          {confirmingClose ? (
            /* ── CONFIRM SCREEN ─────────────────────────────────────────────── */
            <>
              <ScrollView
                style={s.flex}
                contentContainerStyle={s.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Confirm summary card */}
                <View style={s.card}>
                  <View style={[s.colorBar, { backgroundColor: barColor }]} />
                  <View style={s.cardBody}>
                    <Text style={s.confirmSubtitle}>{t('closeShift.confirmFinalSubtitle')}</Text>

                    <View style={s.summaryRow}>
                      <Text style={s.summaryRowLabel}>{t('closeShift.ticketsTotal')}</Text>
                      <Text style={s.summaryRowValue}>${ticketsTotal.toFixed(2)}</Text>
                    </View>
                    {cancelsNum > 0 && (
                      <View style={s.summaryRow}>
                        <Text style={s.summaryRowLabel}>{t('closeShift.cancels')}</Text>
                        <Text style={s.summaryRowValue}>${cancelsNum.toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={s.summaryRow}>
                      <Text style={s.summaryRowLabel}>{t('closeShift.expectedCash')}</Text>
                      <Text style={s.summaryRowValue}>${expectedCash.toFixed(2)}</Text>
                    </View>
                    <View style={s.summaryRow}>
                      <Text style={s.summaryRowLabel}>{t('closeShift.cashInHand')}</Text>
                      <Text style={s.summaryRowValue}>${cashInHandNum.toFixed(2)}</Text>
                    </View>

                    {/* Difference row */}
                    <View style={[s.diffRow, { backgroundColor: diffBg }]}>
                      <Text style={s.diffRowLabel}>{t('closeShift.difference')}</Text>
                      <Text style={[s.diffRowValue, { color: diffColor }]}>{diffAmount}</Text>
                    </View>
                  </View>
                </View>

                {/* Status pill */}
                <View style={[s.statusPill, { backgroundColor: pillBg, alignSelf: 'center' }]}>
                  <Text style={[s.statusPillText, { color: pillColor }]}>{pillLabel}</Text>
                </View>

                <Text style={s.confirmInfoText}>
                  {t('closeShift.confirmFinalInfo', {
                    closed: closedSubshiftCount,
                    voided: voidedSubshiftCount,
                  })}
                </Text>
              </ScrollView>

              {/* Confirm action buttons */}
              <View style={s.submitContainer}>
                <View style={s.confirmActions}>
                  <TouchableOpacity
                    style={s.backButton}
                    onPress={() => setConfirmingClose(false)}
                    disabled={busy}
                  >
                    <Text style={s.backButtonText}>{t('common.back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      s.submitButton,
                      s.submitFlex,
                      { backgroundColor: isExact ? D.SUCCESS : D.PRIMARY },
                      busy && s.submitDisabled,
                    ]}
                    onPress={doClose}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.submitText}>{t('closeShift.endMainShift')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            /* ── MAIN SCREEN ────────────────────────────────────────────────── */
            <>
              <ScrollView
                style={s.flex}
                contentContainerStyle={s.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >

                {/* Live Preview Card */}
                <View style={s.card}>
                  <View style={[s.colorBar, { backgroundColor: barColor }]} />

                  <View style={s.previewHeader}>
                    <Text style={s.previewHeaderLabel}>Live Preview</Text>
                    <View style={[s.statusPill, { backgroundColor: pillBg }]}>
                      <Text style={[s.statusPillText, { color: pillColor }]}>{pillLabel}</Text>
                    </View>
                  </View>

                  <View style={s.statsGrid}>
                    <View style={s.statCell}>
                      <Text style={s.statValue}>${ticketsTotal.toFixed(2)}</Text>
                      <Text style={s.statCaption}>From scans</Text>
                      <Text style={s.statLabel}>Ticket Sales</Text>
                    </View>
                    <View style={[s.statCell, s.statCellRight]}>
                      <Text style={s.statValue}>${expectedCash.toFixed(2)}</Text>
                      <Text style={s.statCaption}>Expected</Text>
                      <Text style={s.statLabel}>Expected Cash</Text>
                    </View>
                  </View>

                  <View style={[s.diffRow, { backgroundColor: diffBg }]}>
                    <Text style={s.diffRowLabel}>Difference</Text>
                    <Text style={[s.diffRowValue, { color: diffColor }]}>{diffAmount}</Text>
                  </View>
                </View>

                {/* Books Pending Warning */}
                {summaryLoading ? (
                  <View style={s.loadingRow}>
                    <ActivityIndicator size="small" color={D.SUBTLE} />
                  </View>
                ) : booksPending > 0 ? (
                  <View style={s.pendingWarning}>
                    <Text style={s.pendingWarningIcon}>⚠️</Text>
                    <View style={s.pendingWarningBody}>
                      <Text style={s.pendingWarningTitle}>
                        {booksPending} {booksPending === 1 ? 'book' : 'books'} still need close scans
                      </Text>
                      <Text style={s.pendingWarningHint}>Complete scanning before closing</Text>
                    </View>
                  </View>
                ) : null}

                {/* Input Fields Section */}
                <View style={s.card}>
                  <View style={s.cardBody}>
                    <Text style={s.sectionTitle}>Shift Details</Text>

                    <InputField
                      label="Cash in Hand"
                      required
                      value={cashInHand}
                      onChangeText={setCashInHand}
                      helper="Total cash at end of shift"
                      focused={focusedField === 'cashInHand'}
                      onFocus={() => setFocusedField('cashInHand')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <InputField
                      label="Gross Sales"
                      required
                      value={grossSales}
                      onChangeText={setGrossSales}
                      helper="Total sales from register"
                      focused={focusedField === 'grossSales'}
                      onFocus={() => setFocusedField('grossSales')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <InputField
                      label="Cash Out"
                      required
                      value={cashOut}
                      onChangeText={setCashOut}
                      helper="Cash removed during shift"
                      focused={focusedField === 'cashOut'}
                      onFocus={() => setFocusedField('cashOut')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <InputField
                      label="Cancels"
                      required
                      value={cancels}
                      onChangeText={setCancels}
                      helper="Lottery machine cancellations"
                      focused={focusedField === 'cancels'}
                      onFocus={() => setFocusedField('cancels')}
                      onBlur={() => setFocusedField(null)}
                      last
                    />
                  </View>
                </View>

              </ScrollView>

              {/* Submit Button */}
              <View style={s.submitContainer}>
                <TouchableOpacity
                  style={[s.submitButton, { backgroundColor: submitBg }, isSubmitDisabled && s.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitDisabled}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.submitText}>{submitText}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function InputField({ label, required, value, onChangeText, helper, focused, onFocus, onBlur, last }) {
  return (
    <View style={[s.fieldGroup, last && s.fieldGroupLast]}>
      <Text style={s.fieldLabel}>
        {label}
        {required && <Text style={s.required}> *</Text>}
      </Text>
      <TextInput
        style={[s.input, focused && s.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder="0.00"
        placeholderTextColor={D.SUBTLE}
        keyboardType="decimal-pad"
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <Text style={s.fieldHelper}>{helper}</Text>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.BACKGROUND },
  flex: { flex: 1 },

  // ── header ──────────────────────────────────────────────────────────────────
  header: {
    height: 56,
    backgroundColor: D.CARD,
    borderBottomWidth: 1,
    borderBottomColor: D.BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SP.lg,
  },
  headerClose: { width: 32, alignItems: 'flex-start' },
  headerCloseIcon: { fontSize: 20, fontWeight: FW.bold, color: D.TEXT },
  headerTitle: { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT },
  shiftBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: SP.sm,
    paddingVertical: 3,
    borderRadius: BR.full,
  },
  shiftBadgeText: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.PRIMARY },
  headerSpacer: { width: 60 },

  // ── scroll ──────────────────────────────────────────────────────────────────
  scrollContent: { padding: SP.lg, paddingBottom: SP.xl },

  // ── card ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    ...CARD_SHADOW,
    marginBottom: SP.md,
    overflow: 'hidden',
  },
  cardBody: { padding: SP.lg },
  colorBar: { height: 4 },

  // ── live preview ─────────────────────────────────────────────────────────────
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
    paddingTop: SP.md,
    paddingBottom: SP.sm,
  },
  previewHeaderLabel: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.SUBTLE },

  statusPill: {
    paddingHorizontal: SP.sm,
    paddingVertical: 3,
    borderRadius: BR.full,
  },
  statusPillText: { fontSize: FS.xs, fontWeight: FW.semibold },

  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
  },
  statCell: { flex: 1 },
  statCellRight: {
    borderLeftWidth: 1,
    borderLeftColor: D.BORDER,
    paddingLeft: SP.lg,
  },
  statValue:   { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT, marginBottom: 2 },
  statCaption: { fontSize: FS.xs, color: D.SUBTLE, marginBottom: 2 },
  statLabel:   { fontSize: FS.xs, color: D.SUBTLE },

  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SP.md,
    paddingHorizontal: SP.lg,
  },
  diffRowLabel: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT },
  diffRowValue: { fontSize: FS.lg, fontWeight: FW.bold },

  // ── books pending warning ────────────────────────────────────────────────────
  loadingRow: { alignItems: 'center', paddingVertical: SP.sm, marginBottom: SP.sm },
  pendingWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF9EE',
    borderWidth: 1,
    borderColor: D.WARNING,
    borderRadius: BR.md,
    padding: SP.md,
    marginBottom: SP.md,
  },
  pendingWarningIcon:  { fontSize: FS.lg, marginRight: SP.sm },
  pendingWarningBody:  { flex: 1 },
  pendingWarningTitle: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.WARNING, marginBottom: 2 },
  pendingWarningHint:  { fontSize: FS.xs, color: D.SUBTLE },

  // ── input fields ─────────────────────────────────────────────────────────────
  sectionTitle: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT, marginBottom: SP.md },
  fieldGroup: { marginBottom: SP.md },
  fieldGroupLast: { marginBottom: 0 },
  fieldLabel: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT, marginBottom: SP.xs },
  required:   { color: D.ERROR },
  input: {
    height: 52,
    backgroundColor: D.BACKGROUND,
    borderWidth: 1.5,
    borderColor: D.BORDER,
    borderRadius: BR.md,
    paddingHorizontal: SP.lg,
    fontSize: FS.md,
    color: D.TEXT,
  },
  inputFocused: { borderColor: D.PRIMARY },
  fieldHelper:  { fontSize: FS.xs, color: D.SUBTLE, marginTop: SP.xs },

  // ── submit area ──────────────────────────────────────────────────────────────
  submitContainer: {
    padding: SP.lg,
    backgroundColor: D.BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: D.BORDER,
  },
  submitButton: {
    height: 52,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitFlex:     { flex: 1 },
  submitText:     { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },
  submitDisabled: { opacity: 0.7, elevation: 0, shadowOpacity: 0 },

  confirmActions: { flexDirection: 'row', gap: SP.sm },
  backButton: {
    height: 52,
    paddingHorizontal: SP.xl,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: D.BACKGROUND,
    borderWidth: 1,
    borderColor: D.BORDER,
  },
  backButtonText: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT },

  // ── confirm screen ────────────────────────────────────────────────────────────
  confirmSubtitle: { fontSize: FS.sm, color: D.SUBTLE, marginBottom: SP.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SP.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: D.BORDER,
  },
  summaryRowLabel: { fontSize: FS.sm, color: D.SUBTLE },
  summaryRowValue: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT },
  confirmInfoText: {
    fontSize: FS.sm,
    color: D.SUBTLE,
    textAlign: 'center',
    marginTop: SP.md,
    marginBottom: SP.sm,
  },
});
