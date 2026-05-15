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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { getCurrentOpenShift, getShiftSummary } from '../api/shifts';
import { getBooksSummary } from '../api/books';
import { recordScan } from '../api/scan';
import CloseShiftModal from '../components/CloseShiftModal';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { friendlyScanError } from '../utils/scanErrorMessages';
import { lastPositionFor, parseBarcode } from '../utils/bookConstants';
import { normalizeBarcode } from '../utils/barcodeUtils';
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '../offline/db';
import { recordOfflineScan, getOfflinePendingCounts } from '../offline';
import { getLocalSlots, saveLocalScan, markLocalBookSold } from '../offline/localDb';

// ── design tokens ──────────────────────────────────────────────────────────────
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
const FS = { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 };
const FW = { regular: '400', medium: '500', semibold: '600', bold: '700' };
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const BR = { sm: 8, md: 12, lg: 16, full: 26 };
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
};

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
  const { scanMode, isOffline, user, store } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [openSubId, setOpenSubId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [totalBooks, setTotalBooks] = useState(0);
  const [hasBooks, setHasBooks] = useState(true);

  const [slots, setSlots] = useState([]);
  const [pendingSlots, setPendingSlots] = useState([]);

  const [barcode, setBarcode] = useState('');
  const initialScanType = route.params?.scanType ?? 'open';
  const justOpened = route.params?.justOpened ?? false;
  const [scanType, setScanType] = useState(initialScanType);
  const [toastVisible, setToastVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const inputRef = useRef(null);
  const lastScanRef = useRef({ barcode: null, timestamp: 0 });
  const justScanned = useRef(false);
  const shiftUuidRef = useRef(null);
  const fireFeedback = useFeedback();

  // display-only: track initial pending count for progress bar
  const totalBooksRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    totalBooksRef.current = totalBooks;
  }, [totalBooks]);

  useEffect(() => {
    if (scanMode !== 'hardware_scanner') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scanMode, pulseAnim]);

  const loadShift = useCallback(async () => {
    let currentlyOffline = false;
    try {
      const netState = await NetInfo.fetch();
      currentlyOffline = !netState.isConnected || netState.isInternetReachable !== true;

      if (currentlyOffline) {
        // OFFLINE PATH — load from local SQLite
        await new Promise(resolve => setTimeout(resolve, 500));
        const db = await getDb();
        if (!db) return;
        const localShift = await db.getFirstAsync(
          `SELECT * FROM local_employee_shifts
           WHERE store_id = ? AND status = 'open'
           ORDER BY id DESC LIMIT 1`,
          [store?.store_id]
        );

        if (!localShift) {
          setShift(null);
          setOpenSubId(null);
          shiftUuidRef.current = null;
          setPendingCount(0);
          setIsInitialized(false);
          return;
        }

        shiftUuidRef.current = localShift.uuid;
        setShift(localShift);
        // Use server_id when available; local rowid as fallback for UI keying
        setOpenSubId(localShift.server_id || localShift.id);

        const counts = await getOfflinePendingCounts(localShift.uuid, store?.store_id);
        setPendingCount(counts.is_initialized
          ? counts.books_pending_close
          : counts.books_pending_open
        );
        const activeBookCount = await db.getFirstAsync(
          `SELECT COUNT(*) as count FROM local_books WHERE store_id = ? AND is_active = 1 AND is_sold = 0`,
          [store?.store_id]
        );
        const totalActive = activeBookCount?.count ?? 0;
        setHasBooks(totalActive > 0);
        setIsInitialized(counts.is_initialized && totalActive > 0);
        const slottedCount = await db.getFirstAsync(
          `SELECT COUNT(*) as count FROM local_books WHERE store_id = ? AND is_active = 1 AND is_sold = 0 AND slot_id IS NOT NULL`,
          [store?.store_id]
        );
        setTotalBooks(slottedCount?.count ?? 0);
        return;
      }

      // ONLINE PATH
      const shift = await getCurrentOpenShift();
      console.log('[loadShift] getCurrentOpenShift response', { shift });
      if (!shift) {
        setShift(null);
        setOpenSubId(null);
        shiftUuidRef.current = null;
        setPendingCount(0);
        setIsInitialized(false);
        return;
      }
      setShift(shift);
      setOpenSubId(shift.id);
      shiftUuidRef.current = shift.uuid || null;
      console.log('[loadShift] shiftUuidRef set', { server_id: shift.id, uuid: shift.uuid, ref: shiftUuidRef.current });
      if (!shift.uuid) {
        console.error('[loadShift] Server returned shift with null UUID — backend bug. shift_id:', shift.id, '— offline features degraded until backend is fixed and backfill runs.');
      }

      try {
        const summary = await getShiftSummary(shift.id);
        // books_pending_open is the correct field (new server); fall back to
        // books_pending_close which also equals total-active on a fresh shift
        // (no close scans exist yet), so the new-shift case is always correct.
        const pending = summary.books_pending_open ?? summary.books_pending_close ?? 0;
        setPendingCount(pending);
        setTotalBooks(summary.books_total_active || 0);
        try {
          const booksSummary = await getBooksSummary();
          const totalActive = booksSummary?.active ?? 0;
          setHasBooks(totalActive > 0);
          setIsInitialized(pending === 0 && totalActive > 0);
        } catch {
          setHasBooks(true);
          setIsInitialized(false);
        }
      } catch {
        setPendingCount(0);
        setIsInitialized(false);
        setHasBooks(true);
      }
    } catch (err) {
      if (!currentlyOffline) {
        Alert.alert(t('home.errorLoadingShift'), err.message || t('common.tryAgain'));
      }
    }
  }, [t, isOffline, store]);

  useFocusEffect(
    useCallback(() => {
      if (justScanned.current) {
        justScanned.current = false;
        return; // skip reload — state is fresh from scan response
      }
      setLoading(true);
      loadShift().finally(() => setLoading(false));
    }, [loadShift])
  );

  const loadSlots = useCallback(async () => {
    try {
      const data = await getLocalSlots(store?.store_id);
      setSlots(data);
    } catch {
    }
  }, [store?.store_id]);

  useFocusEffect(
    useCallback(() => {
      loadSlots();
    }, [loadSlots])
  );

  // Always computed from local SQLite — online scans are written through to
  // local_shift_books synchronously before this is called, so the query is
  // always current regardless of online/offline state.
  const loadPendingSlots = useCallback(async () => {
    const shiftUuid = shiftUuidRef.current;
    const sid = store?.store_id;
    console.log('[loadPendingSlots] called', { shiftUuid, sid, scanType });
    try {
      const db = await getDb();
      if (!shiftUuid || !sid) {
        console.log('[loadPendingSlots] aborting — missing shiftUuid or store_id');
        setPendingSlots([]);
        return;
      }
      const pending = await db.getAllAsync(
        `SELECT lb.static_code, lb.ticket_price, lb.slot_id, ls.slot_name
         FROM local_books lb
         LEFT JOIN local_slots ls ON ls.server_id = lb.slot_id
         WHERE lb.store_id = ?
         AND lb.is_active = 1 AND lb.is_sold = 0
         AND lb.slot_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM local_shift_books sb
           WHERE sb.shift_uuid = ?
           AND sb.static_code = lb.static_code
           AND sb.scan_type = ?
         )
         ORDER BY CAST(ls.slot_name AS INTEGER) ASC`,
        [sid, shiftUuid, scanType]
      );
      console.log('[loadPendingSlots] query result', { count: pending.length, rows: pending });
      setPendingSlots(pending);
      console.log('[loadPendingSlots] state set');
    } catch (err) {
      console.error('[loadPendingSlots] FAILED', err, err?.stack);
    }
  }, [store, scanType]);

  // Load pending slots whenever the active shift or scan type changes
  useEffect(() => {
    if (openSubId) loadPendingSlots();
  }, [openSubId, scanType]);

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

  // Keep input focused in hardware_scanner mode so wedge input is never lost
  useEffect(() => {
    if (scanMode === 'hardware_scanner') {
      const interval = setInterval(() => {
        inputRef.current?.focus();
      }, 500);
      return () => clearInterval(interval);
    }
  }, [scanMode]);

  const proceedWithScan = useCallback(
    async (code, force_sold = null) => {
      setBusy(true);
      try {
        let result;

        if (isOffline) {
          // ── OFFLINE PATH ────────────────────────────────────────────────────
          let shiftUuid = shiftUuidRef.current;
          if (!shiftUuid) {
            const db = await getDb();
            const localShift = openSubId
              ? await db.getFirstAsync(
                  'SELECT uuid FROM local_employee_shifts WHERE server_id = ?',
                  [openSubId]
                )
              : null;
            if (!localShift) {
              throw { code: 'SHIFT_NOT_FOUND', message: 'Shift not found in local database.' };
            }
            shiftUuid = localShift.uuid;
          }
          result = await recordOfflineScan({
            store_id: store?.store_id,
            user_id: user?.user_id,
            shift_server_id: openSubId,
            shift_uuid: shiftUuid,
            barcode: code,
            scan_type: scanType,
            force_sold,
          });
        } else {
          // ── ONLINE PATH ─────────────────────────────────────────────────────
          result = await recordScan({
            shift_id: openSubId,
            barcode: code,
            scan_type: scanType,
            force_sold,
          });
          // Write scan to local SQLite synchronously before loadPendingSlots()
          // runs. recordScan() also does this as fire-and-forget, but that races
          // with the query below. INSERT OR REPLACE on uuid makes this idempotent.
          if (result.scan && shiftUuidRef.current && store?.store_id && user?.user_id) {
            try {
              await saveLocalScan(
                { ...result.scan, static_code: result.book?.static_code, id: null },
                shiftUuidRef.current,
                store.store_id,
                user.user_id
              );
              if (result.book?.is_sold) {
                await markLocalBookSold(result.book.static_code, store.store_id);
              }
            } catch {
              // non-fatal — fire-and-forget in recordScan() is the backup
            }
          }
        }

        // Process result — identical for online and offline
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

        const { pending_scans_remaining, is_initialized } = result;
        justScanned.current = true;
        setPendingCount(pending_scans_remaining);
        setIsInitialized(is_initialized);
        if (is_initialized && scanType === 'open') {
          setScanType('close');
        }
        setBarcode('');
        setTimeout(() => inputRef.current?.focus(), 50);

        loadPendingSlots();

        if (pending_scans_remaining === 0 && scanType === 'open') {
          Alert.alert(
            t('scan.allOpensDoneTitle'),
            t('scan.allOpensDoneBody'),
            [{ text: t('common.ok') }]
          );
        }
        if (scanType === 'close' && pending_scans_remaining === 0 && is_initialized && totalBooksRef.current > 0) {
          setTimeout(() => setShowCloseModal(true), 500);
        }
      } catch (err) {
        fireFeedback('error');
        Alert.alert(t('scan.scanFailed'), friendlyScanError(err, t));
      } finally {
        setBusy(false);
      }
    },
    [openSubId, scanType, isInitialized, t, fireFeedback, isOffline, user, store]
  );

  const submitScan = useCallback(
    async (rawBarcode) => {
      const code = normalizeBarcode(rawBarcode);
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
              { text: t('scan.recordOnly'), style: 'cancel', onPress: () => proceedWithScan(code, false) },
              { text: t('scan.yesSellBook'), onPress: () => showLastTicketDialog2() },
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
              { text: t('common.cancel'), style: 'cancel', onPress: () => showLastTicketDialog1() },
              { text: t('scan.yesMarkSold'), style: 'destructive', onPress: () => proceedWithScan(code, true) },
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
    const normalized = normalizeBarcode(barcode);
    if (!/^\d{13}$/.test(normalized)) return;
    submitScan(normalized);
  }

  function handleOpenCamera() {
    if (!openSubId) {
      Alert.alert(t('scan.noOpenShift'), t('scan.noOpenShiftHint'));
      return;
    }
    const isContinuous = scanMode === 'camera_continuous';
    navigation.navigate('CameraScanner', {
      mode: isContinuous ? 'continuous' : 'single',
      validate: !isOffline,
      onScanned: (data) => { submitScan(data); },
    });
  }

  // ── DEV: db state dump ──────────────────────────────────────────────────────

  async function dumpDbState() {
    try {
      const db = await getDb();
      const shifts = await db.getAllAsync(
        'SELECT id, server_id, uuid, status, store_id FROM local_employee_shifts ORDER BY id DESC LIMIT 5'
      );
      const slots = await db.getAllAsync(
        'SELECT id, server_id, slot_name, ticket_price FROM local_slots WHERE store_id = ?',
        [store?.store_id]
      );
      const books = await db.getAllAsync(
        'SELECT id, server_id, static_code, slot_id, is_active, is_sold FROM local_books WHERE store_id = ? AND is_active = 1',
        [store?.store_id]
      );
      const scans = await db.getAllAsync(
        'SELECT shift_uuid, static_code, scan_type, sync_status FROM local_shift_books WHERE shift_uuid = ?',
        [shiftUuidRef.current]
      );
      console.log('[DB DUMP] shiftUuidRef.current =', shiftUuidRef.current);
      console.log('[DB DUMP] shifts:', shifts);
      console.log('[DB DUMP] slots (store_id=' + store?.store_id + '):', slots);
      console.log('[DB DUMP] active books:', books);
      console.log('[DB DUMP] scans for current shift:', scans);
      console.log('[DB DUMP] pendingSlots state:', pendingSlots);
    } catch (err) {
      console.error('[DB DUMP] FAILED', err);
    }
  }

  // ── render helpers ──────────────────────────────────────────────────────────

  const isBarcodeValid = /^\d{13}$/.test(normalizeBarcode(barcode));
  const pulseBorder = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [D.BORDER, D.PRIMARY],
  });
  const scannedBooks = totalBooks - pendingCount;
  const progressPct = totalBooks > 0 ? scannedBooks / totalBooks : 0;

  // ── loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('scan.title')}</Text>
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={D.PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  // ── no open shift ───────────────────────────────────────────────────────────

  if (!shift || !openSubId) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('scan.title')}</Text>
        </View>
        <View style={s.center}>
          <Text style={s.noShiftEmoji}>📋</Text>
          <Text style={s.noShiftTitle}>{t('scan.noOpenShift')}</Text>
          <Text style={s.noShiftSub}>{t('scan.noOpenShiftHint')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── main render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.flex}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('scan.title')}</Text>
          {openSubId && (
            <View style={s.shiftBadge}>
              <Text style={s.shiftBadgeText}>Shift #{openSubId}</Text>
            </View>
          )}
        </View>

        {/* ── Offline Banner ──────────────────────────────────────────────── */}
        {isOffline && (
          <View style={s.offlineBanner}>
            <Text style={s.offlineBannerText}>⚠️ Offline Mode — scans saved locally</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Empty State (no books assigned) ─────────────────────────── */}
          {!hasBooks ? (
            <View style={s.emptyState}>
              <View style={s.emptyIconCircle}>
                <Text style={{ fontSize: 40 }}>📦</Text>
              </View>
              <Text style={s.emptyTitle}>No Books Assigned</Text>
              <Text style={s.emptySubtitle}>
                Assign lottery books to slots before{'\n'}
                opening a shift for scanning.
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={s.emptyActionButton}
                  onPress={() => navigation.navigate('Books')}
                >
                  <Text style={s.emptyActionText}>Go to Books →</Text>
                </TouchableOpacity>
              )}
              {!isAdmin && (
                <View style={s.emptyHint}>
                  <Text style={s.emptyHintText}>
                    Contact your admin to assign books to slots.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* ── Status Banner ─────────────────────────────────────── */}
              {!isInitialized ? (
                <View style={s.statusWarn}>
                  <Text style={s.statusWarnIcon}>⚠️</Text>
                  <View style={s.statusBody}>
                    <Text style={s.statusWarnTitle}>
                      {t('scan.bannerNotInitialized', { count: pendingCount })}
                    </Text>
                    <Text style={s.statusSub}>Scan all books to initialize this shift</Text>
                  </View>
                </View>
              ) : (
                <View style={s.statusOk}>
                  <Text style={s.statusOkIcon}>{pendingCount > 0 ? '📋' : '✓'}</Text>
                  <View style={s.statusBody}>
                    <Text style={s.statusOkTitle}>
                      {pendingCount > 0
                        ? `${pendingCount} book${pendingCount !== 1 ? 's' : ''} need close scans`
                        : t('scan.bannerInitialized')}
                    </Text>
                    <Text style={s.statusSub}>
                      {pendingCount > 0 ? 'Scan all books to close shift' : 'All books scanned — ready to close'}
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Progress Bar (open and close phases) ─────────────── */}
              {totalBooks > 0 && pendingCount > 0 && (
                <View style={s.progressWrap}>
                  <Text style={s.progressLabel}>
                    {scannedBooks} / {totalBooks} books scanned
                  </Text>
                  <View style={s.progressTrack}>
                    <View
                      style={[
                        s.progressFill,
                        { width: `${Math.round(progressPct * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* ── Scan Type Selector ────────────────────────────────── */}
              <View style={s.selectorCard}>
                <View style={s.selectorRow}>
                  <TouchableOpacity
                    style={[
                      s.selectorOpt,
                      scanType === 'open' && s.selectorOptActive,
                      isInitialized && s.selectorOptDisabled,
                    ]}
                    onPress={() => !isInitialized && setScanType('open')}
                    disabled={isInitialized}
                  >
                    <Text
                      style={[
                        s.selectorTxt,
                        scanType === 'open' && s.selectorTxtActive,
                        isInitialized && s.selectorTxtDim,
                      ]}
                    >
                      {t('scan.open')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      s.selectorOpt,
                      scanType === 'close' && s.selectorOptActive,
                      !isInitialized && s.selectorOptDisabled,
                    ]}
                    onPress={() => isInitialized && setScanType('close')}
                    disabled={!isInitialized}
                  >
                    <Text
                      style={[
                        s.selectorTxt,
                        scanType === 'close' && s.selectorTxtActive,
                        !isInitialized && s.selectorTxtDim,
                      ]}
                    >
                      {t('scan.close')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Camera Button ─────────────────────────────────────── */}
              {scanMode !== 'hardware_scanner' && (
                <TouchableOpacity
                  style={[s.cameraBtn, busy && s.dimmed]}
                  onPress={handleOpenCamera}
                  disabled={busy}
                >
                  <Text style={s.cameraBtnIcon}>📷</Text>
                  <Text style={s.cameraBtnText}>{t('scan.scanWithCamera')}</Text>
                </TouchableOpacity>
              )}

              {/* ── Divider ───────────────────────────────────────────── */}
              {scanMode !== 'hardware_scanner' && (
                <View style={s.divRow}>
                  <View style={s.divLine} />
                  <Text style={s.divTxt}>{t('scan.orEnterManually')}</Text>
                  <View style={s.divLine} />
                </View>
              )}

              {/* ── Barcode Input ─────────────────────────────────────── */}
              <Animated.View
                style={[
                  s.inputWrap,
                  scanMode === 'hardware_scanner' && { borderColor: pulseBorder },
                ]}
              >
                <TextInput
                  ref={inputRef}
                  style={s.input}
                  value={barcode}
                  onChangeText={(text) => {
                    const normalized = normalizeBarcode(text);
                    setBarcode(normalized);
                    if (scanMode === 'hardware_scanner' && normalized.length === 13) {
                      submitScan(normalized);
                      setBarcode('');
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }
                  }}
                  placeholder={
                    scanMode === 'hardware_scanner'
                      ? 'Waiting for scanner...'
                      : t('scan.barcodePlaceholder')
                  }
                  placeholderTextColor={D.SUBTLE}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numeric"
                  maxLength={scanMode === 'hardware_scanner' ? 14 : 20}
                  returnKeyType="done"
                  onSubmitEditing={handleManualScan}
                  autoFocus={false}
                  showSoftInputOnFocus={false}
                  onBlur={() => {
                    if (scanMode === 'hardware_scanner') {
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }
                  }}
                />
              </Animated.View>

              {/* ── Submit Button (manual / camera mode) ──────────────── */}
              {scanMode !== 'hardware_scanner' && (
                <TouchableOpacity
                  style={[s.submitBtn, (!isBarcodeValid || busy) && s.dimmed]}
                  onPress={handleManualScan}
                  disabled={!isBarcodeValid || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.submitBtnTxt}>{t('scan.submitScan')}</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* ── Hardware scanner hint ──────────────────────────────── */}
              {scanMode === 'hardware_scanner' && (
                <Text style={s.scannerHint}>
                  Point scanner at barcode to scan automatically
                </Text>
              )}

              {/* ── DEV: DB dump button ──────────────────────────────── */}
              <TouchableOpacity onPress={dumpDbState} style={s.devBtn}>
                <Text style={s.devBtnTxt}>DEV: Dump DB State</Text>
              </TouchableOpacity>

              {/* ── Pending Slots ─────────────────────────────────────── */}
              {pendingSlots.length > 0 && (
                <View style={s.pendingSlotsContainer}>
                  <View style={s.pendingSlotsHeader}>
                    <Text style={s.pendingSlotsTitle}>
                      {scanType === 'open' ? 'Needs Open Scan' : 'Needs Close Scan'}
                    </Text>
                    <View style={s.pendingCountBadge}>
                      <Text style={s.pendingCountText}>{pendingSlots.length}</Text>
                    </View>
                  </View>
                  <View style={s.slotsGrid}>
                    {pendingSlots.map((slot, index) => (
                      <View key={slot.static_code || index} style={s.slotChip}>
                        <Text style={s.slotChipName}>
                          {slot.slot_name || `Slot ${slot.slot_id}`}
                        </Text>
                        <Text style={s.slotChipPrice}>
                          ${parseFloat(slot.ticket_price).toFixed(0)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* ── Last Scan Card ────────────────────────────────────── */}
              {lastScan && (
                <View style={s.lastCard}>
                  <View style={s.lastCardMain}>
                    {lastScan.book?.is_sold ? (
                      <View style={s.ticketCircle}>
                        <Text style={s.ticketStar}>⭐</Text>
                      </View>
                    ) : (
                      <View style={s.successCircle}>
                        <Text style={s.successCheck}>✓</Text>
                      </View>
                    )}
                    <View style={s.lastCardInfo}>
                      <Text style={s.lastCardCode}>{lastScan.book?.static_code}</Text>
                      <View style={s.lastCardMeta}>
                        <View
                          style={[
                            s.typeBadge,
                            lastScan.scan?.scan_type === 'open'
                              ? s.typeBadgeOpen
                              : s.typeBadgeClose,
                          ]}
                        >
                          <Text
                            style={[
                              s.typeBadgeTxt,
                              lastScan.scan?.scan_type === 'open'
                                ? s.typeBadgeTxtOpen
                                : s.typeBadgeTxtClose,
                            ]}
                          >
                            {lastScan.scan?.scan_type === 'open'
                              ? t('scan.open')
                              : t('scan.close')}
                          </Text>
                        </View>
                        {lastScan.scan?.start_at_scan != null && (
                          <Text style={s.lastCardPos}>
                            #{lastScan.scan.start_at_scan}
                          </Text>
                        )}
                      </View>
                      {lastScan.scan?.slot_name != null && (
                        <Text style={s.lastCardSlot}>{lastScan.scan.slot_name}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={s.sessionCount}>
                    {t('scan.scansThisSession', { count: scanCount })}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

      </KeyboardAvoidingView>

      {/* ── Close Shift Modal (auto-shown when all close scans done) ───────── */}
      <CloseShiftModal
        visible={showCloseModal}
        subshiftId={openSubId}
        shiftUuid={shiftUuidRef.current}
        onCancel={() => setShowCloseModal(false)}
        onSubmit={async (result) => {
          console.log('[ScanScreen] onSubmit START', { result });
          console.error('[close modal] shiftId:', openSubId);
          console.error('[close modal] shiftUuid:', shiftUuidRef.current);
          setShowCloseModal(false);
          setShift(null);
          setOpenSubId(null);
          setIsInitialized(false);
          setPendingCount(0);
          setScanType('open');
          navigation.navigate('Home', { refresh: true });
          console.log('[ScanScreen] onSubmit END');
        }}
      />

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toastVisible && (
        <View style={s.toast}>
          <Text style={s.toastTxt}>{t('scan.shiftOpenedToast')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: D.BACKGROUND },
  flex:     { flex: 1 },

  // header
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
  headerTitle:    { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT },
  shiftBadge:     { backgroundColor: '#DBEAFE', paddingHorizontal: SP.md, paddingVertical: SP.xs, borderRadius: BR.full },
  shiftBadgeText: { fontSize: FS.xs, fontWeight: FW.semibold, color: D.PRIMARY },

  // offline
  offlineBanner:     { backgroundColor: D.WARNING, padding: 10, alignItems: 'center' },
  offlineBannerText: { color: '#fff', fontWeight: FW.semibold, fontSize: FS.sm },

  // scroll
  scroll: { padding: SP.lg, paddingBottom: 100 },

  // loading / no-shift
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SP.xl },
  noShiftEmoji: { fontSize: 48, marginBottom: SP.md },
  noShiftTitle: { fontSize: FS.lg, fontWeight: FW.semibold, color: D.TEXT, marginBottom: SP.sm, textAlign: 'center' },
  noShiftSub:   { fontSize: FS.sm, color: D.SUBTLE, textAlign: 'center' },

  // status banners
  statusWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF9EE',
    borderLeftWidth: 3,
    borderLeftColor: D.WARNING,
    paddingVertical: SP.md,
    paddingHorizontal: SP.lg,
    borderRadius: BR.sm,
    marginBottom: SP.sm,
  },
  statusOk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: D.SUCCESS,
    paddingVertical: SP.md,
    paddingHorizontal: SP.lg,
    borderRadius: BR.sm,
    marginBottom: SP.sm,
  },
  statusWarnIcon: { fontSize: FS.md, marginRight: SP.sm, lineHeight: 22 },
  statusOkIcon:   { fontSize: FS.md, fontWeight: FW.bold, color: D.SUCCESS, marginRight: SP.sm, lineHeight: 22 },
  statusBody:     { flex: 1 },
  statusWarnTitle:{ fontSize: FS.sm, fontWeight: FW.semibold, color: D.WARNING, marginBottom: 2 },
  statusOkTitle:  { fontSize: FS.sm, fontWeight: FW.semibold, color: D.SUCCESS, marginBottom: 2 },
  statusSub:      { fontSize: FS.xs, color: D.SUBTLE },

  // progress bar
  progressWrap:  { marginBottom: SP.md },
  progressLabel: { fontSize: FS.xs, color: D.SUBTLE, marginBottom: SP.xs },
  progressTrack: { height: 4, backgroundColor: D.BORDER, borderRadius: BR.full, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: D.PRIMARY, borderRadius: BR.full },

  // close count
  closeCountWrap: { marginBottom: SP.md },
  closeCountText: { fontSize: FS.xs, color: D.SUBTLE },

  // scan type selector
  selectorCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    padding: SP.sm,
    marginBottom: SP.md,
    ...CARD_SHADOW,
  },
  selectorRow:        { flexDirection: 'row', gap: SP.sm },
  selectorOpt: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BR.md,
    borderWidth: 1,
    borderColor: D.BORDER,
    backgroundColor: D.BACKGROUND,
  },
  selectorOptActive: {
    backgroundColor: D.PRIMARY,
    borderColor: D.PRIMARY,
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  selectorOptDisabled: { opacity: 0.4 },
  selectorTxt:         { fontSize: FS.sm, fontWeight: FW.semibold, color: D.SUBTLE },
  selectorTxtActive:   { color: '#fff' },
  selectorTxtDim:      { color: D.SUBTLE },

  // camera button
  cameraBtn: {
    height: 52,
    backgroundColor: D.PRIMARY,
    borderRadius: BR.full,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SP.sm,
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraBtnIcon: { fontSize: FS.md, marginRight: SP.sm },
  cameraBtnText: { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },

  // divider
  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: SP.sm },
  divLine: { flex: 1, height: 1, backgroundColor: D.BORDER },
  divTxt:  { fontSize: FS.xs, color: D.SUBTLE, marginHorizontal: SP.sm },

  // barcode input
  inputWrap: {
    height: 52,
    backgroundColor: D.CARD,
    borderWidth: 1.5,
    borderColor: D.BORDER,
    borderRadius: BR.md,
    marginBottom: SP.sm,
    paddingHorizontal: SP.lg,
    justifyContent: 'center',
  },
  input: { fontSize: FS.md, color: D.TEXT, padding: 0 },

  // submit button
  submitBtn: {
    height: 52,
    backgroundColor: D.PRIMARY,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SP.md,
  },
  submitBtnTxt: { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },

  dimmed: { opacity: 0.4 },

  // dev dump button
  devBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: D.BORDER,
    borderRadius: BR.sm,
    padding: SP.sm,
    alignItems: 'center',
    marginBottom: SP.sm,
  },
  devBtnTxt: { fontSize: FS.xs, color: D.SUBTLE, fontFamily: 'monospace' },

  // scanner hint
  scannerHint: {
    fontSize: FS.xs,
    color: D.SUBTLE,
    textAlign: 'center',
    marginBottom: SP.sm,
    fontStyle: 'italic',
  },

  // last scan card
  lastCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    padding: SP.lg,
    marginTop: SP.sm,
    ...CARD_SHADOW,
  },
  lastCardMain:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SP.sm },
  successCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: D.SUCCESS,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SP.md,
  },
  successCheck: { color: '#fff', fontSize: FS.md, fontWeight: FW.bold },
  ticketCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SP.md,
  },
  ticketStar:     { fontSize: FS.md },
  lastCardInfo:   { flex: 1 },
  lastCardCode:   { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT, marginBottom: SP.xs },
  lastCardMeta:   { flexDirection: 'row', alignItems: 'center', marginBottom: SP.xs },
  typeBadge:      { paddingHorizontal: SP.sm, paddingVertical: 2, borderRadius: BR.full, marginRight: SP.xs },
  typeBadgeOpen:  { backgroundColor: '#DBEAFE' },
  typeBadgeClose: { backgroundColor: '#DCFCE7' },
  typeBadgeTxt:       { fontSize: FS.xs, fontWeight: FW.semibold },
  typeBadgeTxtOpen:   { color: D.PRIMARY },
  typeBadgeTxtClose:  { color: D.SUCCESS },
  lastCardPos:    { fontSize: FS.sm, color: D.SUBTLE },
  lastCardSlot:   { fontSize: FS.xs, color: D.SUBTLE },
  sessionCount:   { fontSize: FS.xs, color: D.SUBTLE, textAlign: 'right' },

  // empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyActionButton: {
    backgroundColor: '#0077CC',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 26,
    marginBottom: 12,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyHint: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  emptyHintText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },

  // pending slots
  pendingSlotsContainer: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    padding: SP.md,
    marginTop: SP.sm,
    marginBottom: SP.sm,
    ...CARD_SHADOW,
  },
  pendingSlotsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SP.sm,
  },
  pendingSlotsTitle: {
    fontSize: FS.sm,
    fontWeight: FW.semibold,
    color: D.TEXT,
  },
  pendingCountBadge: {
    backgroundColor: D.ERROR,
    borderRadius: BR.full,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  pendingCountText: {
    color: '#FFFFFF',
    fontSize: FS.xs,
    fontWeight: FW.bold,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SP.xs,
  },
  slotChip: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BR.sm,
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotChipName: {
    fontSize: FS.xs,
    fontWeight: FW.bold,
    color: D.ERROR,
  },
  slotChipPrice: {
    fontSize: FS.xs,
    color: D.ERROR,
  },

  // toast
  toast: {
    position: 'absolute',
    bottom: 24,
    left: SP.lg,
    right: SP.lg,
    backgroundColor: D.PRIMARY,
    paddingVertical: SP.md,
    paddingHorizontal: SP.lg,
    borderRadius: BR.md,
    zIndex: 1000,
    elevation: 4,
    ...CARD_SHADOW,
  },
  toastTxt: { color: '#fff', fontSize: FS.sm, fontWeight: FW.medium, textAlign: 'center' },
});
