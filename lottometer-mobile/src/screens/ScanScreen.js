import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { getCurrentOpenShift, getShiftSummary } from '../api/shifts';
import { recordScan } from '../api/scan';
import { listSlots } from '../api/slots';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { friendlyScanError } from '../utils/scanErrorMessages';
import { lastPositionFor, parseBarcode } from '../utils/bookConstants';

function detectLastTicket(trimmedBarcode, scanType, slots) {
  if (scanType !== 'close') return false;
  const parsed = parseBarcode(trimmedBarcode);
  if (!parsed || isNaN(parsed.position)) return false;
  const slot = slots.find((s) => s.current_book?.static_code === parsed.static_code);
  if (!slot) return false;
  const last = lastPositionFor(slot.ticket_price);
  return last !== null && parsed.position === last;
}

export default function ScanScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { scanMode } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [openSubId, setOpenSubId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const [slots, setSlots] = useState([]);

  const [barcode, setBarcode] = useState('');
  const initialScanType = route.params?.scanType ?? 'open';
  const justOpened = route.params?.justOpened ?? false;
  const [scanType, setScanType] = useState(initialScanType);
  const [toastVisible, setToastVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanCount, setScanCount] = useState(0);

  const inputRef = useRef(null);
  const lastScanRef = useRef({ barcode: null, timestamp: 0 });
  const fireFeedback = useFeedback();

  const loadShift = useCallback(async () => {
    try {
      const shift = await getCurrentOpenShift();
      if (!shift) {
        setShift(null);
        setOpenSubId(null);
        setPendingCount(0);
        setIsInitialized(true);
        return;
      }
      setShift(shift);
      setOpenSubId(shift.id);

      try {
        const summary = await getShiftSummary(shift.id);
        const pending = summary.books_pending_close ?? 0;
        setPendingCount(pending);
        setIsInitialized(pending === 0);
      } catch {
        setPendingCount(0);
        setIsInitialized(true);
      }
    } catch (err) {
      Alert.alert(t('home.errorLoadingShift'), err.message || t('common.tryAgain'));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadShift().finally(() => setLoading(false));
    }, [loadShift])
  );

  const loadSlots = useCallback(async () => {
    try {
      const result = await listSlots();
      setSlots(result.slots || []);
    } catch (err) {
      console.warn('[ScanScreen] failed to load slots:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSlots();
    }, [loadSlots])
  );

  useEffect(() => {
    setScanType(isInitialized ? 'close' : 'open');
  }, [isInitialized]);

  useEffect(() => {
    if (justOpened) {
      setToastVisible(true);
      const timer = setTimeout(() => setToastVisible(false), 3000);
      navigation.setParams({ justOpened: undefined });
      return () => clearTimeout(timer);
    }
  }, [justOpened]);

  const proceedWithScan = useCallback(
    async (code, force_sold = null) => {
      setBusy(true);
      try {
        const result = await recordScan({
          shift_id: openSubId,
          barcode: code,
          scan_type: scanType,
          force_sold,
        });
        setLastScan({
          scan: result.scan,
          book: result.book,
          running_totals: result.running_totals,
          pending_scans_remaining: result.pending_scans_remaining,
          is_initialized: result.is_initialized,
        });
        fireFeedback(result.book?.is_sold ? 'last_ticket' : 'success');
        setToastVisible(false);
        setScanCount((c) => c + 1);

        const wasPending = pendingCount > 0;
        const isNowZero = result.pending_scans_remaining === 0;
        setPendingCount(result.pending_scans_remaining);
        setIsInitialized(result.is_initialized);
        setBarcode('');
        setTimeout(() => inputRef.current?.focus(), 50);

        if (wasPending && isNowZero && scanType === 'open') {
          Alert.alert(
            t('scan.allOpensDoneTitle'),
            t('scan.allOpensDoneBody'),
            [{ text: t('common.ok') }]
          );
        }
      } catch (err) {
        fireFeedback('error');
        Alert.alert(t('scan.scanFailed'), friendlyScanError(err, t));
      } finally {
        setBusy(false);
      }
    },
    [openSubId, scanType, t, fireFeedback, pendingCount]
  );

  const submitScan = useCallback(
    async (rawBarcode) => {
      const code = (rawBarcode || '').trim();
      if (!/^\d{13}$/.test(code)) return;

      const now = Date.now();
      if (code === lastScanRef.current.barcode && now - lastScanRef.current.timestamp < 2000) {
        setBarcode('');
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
      lastScanRef.current = { barcode: code, timestamp: now };

      if (!openSubId) {
        Alert.alert(t('scan.noOpenShift'), t('scan.noOpenShiftHint'));
        return;
      }

      if (detectLastTicket(code, scanType, slots)) {
        const staticCode = code.slice(0, -3);
        const slot = slots.find((s) => s.current_book?.static_code === staticCode);

        function showLastTicketDialog1() {
          Alert.alert(
            t('scan.lastTicketTitle'),
            t('scan.lastTicketBody1'),
            [
              {
                text: t('scan.recordOnly'),
                style: 'cancel',
                onPress: () => proceedWithScan(code, false),
              },
              {
                text: t('scan.yesSellBook'),
                onPress: () => showLastTicketDialog2(),
              },
            ]
          );
        }

        function showLastTicketDialog2() {
          const slotName = slot?.slot_name || '?';
          const price = slot?.ticket_price || '?';
          Alert.alert(
            t('scan.confirmSaleTitle'),
            t('scan.confirmSaleBody', { slotName, price: `$${price}` }),
            [
              {
                text: t('common.cancel'),
                style: 'cancel',
                onPress: () => showLastTicketDialog1(),
              },
              {
                text: t('scan.yesMarkSold'),
                style: 'destructive',
                onPress: () => proceedWithScan(code, true),
              },
            ]
          );
        }

        showLastTicketDialog1();
        return;
      }

      await proceedWithScan(code);
    },
    [openSubId, scanType, t, slots, proceedWithScan]
  );

  function handleManualScan() {
    const trimmedBarcode = barcode.trim();
    if (!/^\d{13}$/.test(trimmedBarcode)) return;
    submitScan(trimmedBarcode);
  }

  function handleDonePress() {
    Alert.alert(
      t('scan.allClosesDoneTitle'),
      t('scan.allClosesDoneBody'),
      [
        { text: t('scan.notYet'), style: 'cancel' },
        {
          text: t('scan.yesClose'),
          onPress: () => navigation.navigate('Home'),
        },
      ]
    );
  }

  function handleOpenCamera() {
    if (!openSubId) {
      Alert.alert(t('scan.noOpenShift'), t('scan.noOpenShiftHint'));
      return;
    }
    const isContinuous = scanMode === 'camera_continuous';
    navigation.navigate('CameraScanner', {
      mode: isContinuous ? 'continuous' : 'single',
      onScanned: (data) => {
        // Same handler in both modes — submitScan fires the API.
        // In continuous mode it gets called once per scan while the
        // camera stays open; in single mode it's called once and the
        // camera closes immediately after.
        submitScan(data);
      },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!shift || !openSubId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>{t('scan.title')}</Text>
          <Text style={styles.subtitle}>{t('scan.noOpenShift')}</Text>
          <Text style={styles.subtitle}>{t('scan.noOpenShiftHint')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBarcodeValid = /^\d{13}$/.test(barcode.trim());

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('scan.title')}</Text>

          {!isInitialized ? (
            <View style={[styles.banner, styles.bannerWarn]}>
              <Text style={styles.bannerText}>
                {t('scan.bannerNotInitialized', { count: pendingCount })}
              </Text>
            </View>
          ) : (
            <View style={[styles.banner, styles.bannerOk]}>
              <Text style={styles.bannerText}>{t('scan.bannerInitialized')}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>{t('scan.scanType')}</Text>
            <View style={styles.pickerRow}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  scanType === 'open' && styles.pickerOptionActive,
                  isInitialized && styles.pickerOptionDisabled,
                ]}
                onPress={() => !isInitialized && setScanType('open')}
                disabled={isInitialized}
              >
                <Text
                  style={[
                    styles.pickerText,
                    scanType === 'open' && styles.pickerTextActive,
                    isInitialized && styles.pickerTextDisabled,
                  ]}
                >
                  {t('scan.open')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  scanType === 'close' && styles.pickerOptionActive,
                  !isInitialized && styles.pickerOptionDisabled,
                ]}
                onPress={() => isInitialized && setScanType('close')}
                disabled={!isInitialized}
              >
                <Text
                  style={[
                    styles.pickerText,
                    scanType === 'close' && styles.pickerTextActive,
                    !isInitialized && styles.pickerTextDisabled,
                  ]}
                >
                  {t('scan.close')}
                </Text>
              </TouchableOpacity>
            </View>

            {scanMode !== 'hardware_scanner' && (
              <>
                <TouchableOpacity
                  style={[styles.cameraButton, busy && styles.disabled]}
                  onPress={handleOpenCamera}
                  disabled={busy}
                >
                  <Text style={styles.cameraButtonText}>{t('scan.scanWithCamera')}</Text>
                </TouchableOpacity>

                <Text style={styles.divider}>{t('scan.orEnterManually')}</Text>
              </>
            )}

            <Text style={styles.label}>{t('scan.barcode')}</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder={t('scan.barcodePlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={handleManualScan}
              autoFocus={scanMode === 'hardware_scanner'}
            />

            <TouchableOpacity
              style={[styles.scanButton, (!isBarcodeValid || busy) && styles.disabled]}
              onPress={handleManualScan}
              disabled={!isBarcodeValid || busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.scanButtonText}>{t('scan.submitScan')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {lastScan && (
            <View
              style={[
                styles.card,
                styles.lastScanCard,
                lastScan.book?.is_sold && styles.lastTicketCard,
              ]}
            >
              <Text style={styles.lastScanTitle}>
                {lastScan.book?.is_sold
                  ? t('scan.lastTicketSold')
                  : t('scan.scanRecorded')}
              </Text>
              <KV k={t('scan.fieldType')} v={lastScan.scan?.scan_type} />
              <KV k={t('scan.fieldPosition')} v={lastScan.scan?.start_at_scan} />
              <KV k={t('scan.fieldBook')} v={lastScan.book?.static_code} />
              <KV k={t('scan.fieldPrice')} v={lastScan.book?.ticket_price} />
              <KV k={t('scan.fieldSource')} v={lastScan.scan?.scan_source} />
            </View>
          )}

          {isInitialized && (
            <TouchableOpacity style={styles.doneButton} onPress={handleDonePress}>
              <Text style={styles.doneButtonText}>{t('scan.done')}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('scan.scansThisSession', { count: scanCount })}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {toastVisible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{t('scan.shiftOpenedToast')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function KV({ k, v }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvValue}>{v ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 4 },

  banner: { borderRadius: 8, padding: 12, marginBottom: 12 },
  bannerWarn: { backgroundColor: '#fef3c7' },
  bannerOk: { backgroundColor: '#dcfce7' },
  bannerText: { fontSize: 13, color: '#222' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
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

  pickerRow: { flexDirection: 'row', gap: 8 },
  pickerOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  pickerOptionActive: {
    borderColor: '#1a73e8',
    backgroundColor: '#e8f0fe',
  },
  pickerOptionDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#eee',
    opacity: 0.5,
  },
  pickerText: { color: '#666', fontWeight: '600' },
  pickerTextActive: { color: '#1a73e8' },
  pickerTextDisabled: { color: '#aaa' },

  cameraButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  cameraButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  divider: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginVertical: 12,
  },

  scanButton: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },

  lastScanCard: { borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  lastTicketCard: { borderLeftColor: '#dc2626', backgroundColor: '#fef2f2' },
  lastScanTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvKey: { color: '#666', fontSize: 13 },
  kvValue: { color: '#222', fontSize: 13, fontWeight: '600' },

  doneButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  footer: { alignItems: 'center', marginTop: 8 },
  footerText: { color: '#888', fontSize: 12 },

  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 1000,
    elevation: 4,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});