import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../offline/db';
import { openOfflineShift, syncPendingItems } from '../offline';
import { openShift, listShifts, closeShift, getShiftSummary, getCurrentOpenShift } from '../api/shifts';
import { getSubscription } from '../api/subscription';
import TrialBannerComponent from './TrialBannerComponent';
import { getTodaysBusinessDay, closeBusinessDay } from '../api/businessDays';
import CloseShiftModal from '../components/CloseShiftModal';
import WholeBookSaleModal from '../components/WholeBookSaleModal';
import ReturnBookModal from '../components/ReturnBookModal';
import BooksDashboard from '../components/BooksDashboard';
import { formatBusinessDate, formatLocalTime } from '../utils/dateTime';
import { debugLocalDb } from '../offline/debugDb';

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
const FS = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24 };
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

// ── helpers ────────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getShiftDuration(openedAt) {
  if (!openedAt) return '—';
  const ms = Date.now() - new Date(openedAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function getShiftStatusInfo(summary) {
  if (!summary) return { label: 'Active', color: D.PRIMARY };
  if (summary.books_pending_open != null) {
    return summary.books_pending_open === 0
      ? { label: 'Initialized', color: D.SUCCESS }
      : { label: 'Scanning', color: D.WARNING };
  }
  return { label: 'Active', color: D.PRIMARY };
}

function getBooksCount(summary) {
  if (!summary) return '—';
  if (summary.books_pending_open != null && summary.books_pending_open > 0) {
    return `${summary.books_pending_open}`;
  }
  if (summary.books_pending_close != null) {
    return `${summary.books_pending_close}`;
  }
  return '—';
}

// ── screen ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, store, isOffline } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy]             = useState(false);

  const [businessDay, setBusinessDay]   = useState(null);
  const [todayShifts, setTodayShifts]   = useState([]);
  const [activeShift, setActiveShift]   = useState(null);
  const [summary, setSummary]           = useState(null);

  const [subscription, setSubscription] = useState(null);

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [wbSaleOpen, setWbSaleOpen]         = useState(false);
  const [returnOpen, setReturnOpen]         = useState(false);

  // ── data loading ───────────────────────────────────────────────────────────

  const loadPendingSyncCount = useCallback(async () => {
    try {
      const db = await getDb();
      const result = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
      );
      setPendingSyncCount(result?.count ?? 0);
    } catch {
      setPendingSyncCount(0);
    }
  }, []);

  const loadData = useCallback(async () => {
    debugLocalDb().catch(() => {});

    // Read connectivity directly — avoids race where context isOffline
    // hasn't propagated yet when loadData first runs after navigation.
    const netState = await NetInfo.fetch();
    const currentlyOffline = !netState.isConnected || netState.isInternetReachable === false;

    if (currentlyOffline) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const db = await getDb();
        if (!db) return;
        const today = new Date().toISOString().split('T')[0];

        const allShifts = await db.getAllAsync(
          'SELECT server_id, uuid, status, store_id FROM local_employee_shifts'
        );
        console.log('[home offline] all local shifts:', JSON.stringify(allShifts));
        console.log('[home offline] looking for store_id:', store?.store_id);

        const localShift = await db.getFirstAsync(
          `SELECT * FROM local_employee_shifts
           WHERE store_id = ? AND status = 'open'
           ORDER BY id DESC LIMIT 1`,
          [store?.store_id]
        );
        console.log('[home offline] found shift:', JSON.stringify(localShift));

        const localDay = await db.getFirstAsync(
          `SELECT * FROM local_business_days WHERE store_id = ? AND business_date = ?`,
          [store?.store_id, today]
        );
        if (localDay) {
          setBusinessDay({
            id: localDay.server_id,
            uuid: localDay.uuid,
            business_date: localDay.business_date,
            status: localDay.status,
          });

          const localShifts = await db.getAllAsync(
            `SELECT * FROM local_employee_shifts WHERE business_day_uuid = ?`,
            [localDay.uuid]
          );
          setTodayShifts(localShifts.map(s => ({
            id: s.server_id,
            uuid: s.uuid,
            status: s.status,
            shift_number: s.shift_number,
            shift_status: s.shift_status,
            voided: false,
          })));

          // Prefer shift found via business_day_uuid; fall back to localShift
          // (found by store_id) to handle business_day_uuid mismatch cases.
          const activeShiftRow = localShifts.find(s => s.status === 'open') || localShift || null;
          if (activeShiftRow) {
            setActiveShift({
              id: activeShiftRow.server_id,
              uuid: activeShiftRow.uuid,
              shift_number: activeShiftRow.shift_number,
              status: activeShiftRow.status,
              opened_at: activeShiftRow.opened_at,
              employee_id: activeShiftRow.employee_id,
            });

            const closeCount = await db.getFirstAsync(
              `SELECT COUNT(*) as count FROM local_shift_books
               WHERE shift_uuid = ? AND scan_type = 'close'`,
              [activeShiftRow.uuid]
            );
            const totalActive = await db.getFirstAsync(
              `SELECT COUNT(*) as count FROM local_books
               WHERE store_id = ? AND is_active = 1 AND is_sold = 0`,
              [store?.store_id]
            );
            setSummary({
              books_pending_close: (totalActive?.count || 0) - (closeCount?.count || 0),
            });
          } else {
            setActiveShift(null);
            setSummary(null);
          }
        } else {
          setBusinessDay(null);
          setTodayShifts([]);
          setActiveShift(null);
          setSummary(null);
        }
      } catch (err) {
        console.warn('[HomeScreen] offline loadData error:', err.message);
      }
      return;
    }

    // ONLINE PATH — unchanged
    try {
      const subRes = await getSubscription().catch(() => null);
      if (subRes) setSubscription(subRes.data);
    } catch { /* subscription status is non-critical */ }

    try {
      const bd = await getTodaysBusinessDay();
      setBusinessDay(bd);

      const [shiftsResult, open] = await Promise.all([
        listShifts({ business_day_id: bd.id }),
        getCurrentOpenShift(),
      ]);

      const shifts = shiftsResult?.shifts ?? shiftsResult ?? [];
      setTodayShifts(shifts);
      setActiveShift(open);

      if (open) {
        try {
          const s = await getShiftSummary(open.id);
          setSummary(s);
        } catch {
          setSummary(null);
        }
      } else {
        setSummary(null);
      }
    } catch (err) {
      Alert.alert(t('home.errorLoadingShift'), err.message || t('common.networkError'));
    }
  }, [t, isOffline, store]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadData(), loadPendingSyncCount()]).finally(() => setLoading(false));
    }, [loadData, loadPendingSyncCount])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      const result = await syncPendingItems((progress) => {
        console.log('[sync progress]', progress);
      });

      if (result.synced > 0) {
        Alert.alert('Sync Complete', `${result.synced} item(s) synced successfully.`);
      }
      if (result.conflicts > 0) {
        Alert.alert('Sync Conflicts', `${result.conflicts} conflict(s) found. Please review.`);
      }

      await loadData();
      await loadPendingSyncCount();
    } finally {
      setIsSyncing(false);
    }
  }

  // ── actions ────────────────────────────────────────────────────────────────

  async function handleOpenShift() {
    setBusy(true);
    try {
      if (isOffline) {
        // OFFLINE PATH
        const result = await openOfflineShift(store?.store_id, user?.user_id);
        setActiveShift({
          id: null,
          uuid: result.employee_shift.uuid,
          shift_number: result.employee_shift.shift_number,
          status: 'open',
          opened_at: result.employee_shift.opened_at,
          employee_id: result.employee_shift.employee_id,
        });
        navigation.navigate('Scan', {
          scanType: 'open',
          justOpened: true,
          shiftUuid: result.employee_shift.uuid,
        });
      } else {
        // ONLINE PATH — unchanged
        await openShift();
        await loadData();
        navigation.navigate('Scan', { scanType: 'open', justOpened: true });
      }
    } catch (err) {
      Alert.alert(t('home.couldNotOpenShift'), err.message || t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseShiftSubmit(payload) {
    if (!activeShift) return;
    try {
      if (payload?.offline) {
        // OFFLINE PATH — shift already closed by CloseShiftModal
        setCloseModalOpen(false);
        setActiveShift(null);   // clear immediately so UI flips before loadData resolves
        setSummary(null);
        await loadData();
        Alert.alert(t('home.mainShiftClosed'), t('home.mainShiftClosedHint'));
      } else {
        // ONLINE PATH — unchanged
        await closeShift(activeShift.id, payload);
        setCloseModalOpen(false);
        await loadData();
        Alert.alert(t('home.mainShiftClosed'), t('home.mainShiftClosedHint'));
      }
    } catch (err) {
      if (err.code === 'BOOKS_NOT_CLOSED') {
        Alert.alert(t('closeShift.booksNotClosed'), err.message || t('closeShift.booksNotClosedHint'));
      } else {
        Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
      }
      throw err;
    }
  }

  async function handleCloseBizDay() {
    if (!businessDay) return;
    Alert.alert(
      t('home.closeBizDayTitle'),
      t('home.closeBizDayConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('home.closeBizDay'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await closeBusinessDay(businessDay.id);
              await loadData();
              Alert.alert(t('home.bizDayClosed'), t('home.bizDayClosedHint'));
            } catch (err) {
              Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function handleWbSuccess(extraSale) {
    setWbSaleOpen(false);
    Alert.alert(
      t('wholeBook.wholeBookSold'),
      t('wholeBook.wholeBookSoldDetails', {
        count: extraSale.ticket_count,
        price: extraSale.ticket_price,
        value: extraSale.value,
      })
    );
    loadData();
  }

  function handleReturnSuccess(result) {
    setReturnOpen(false);
    Alert.alert(
      t('returnBook.bookReturned'),
      result.close_scan_recorded
        ? t('returnBook.revenuePreserved', { position: result.position })
        : t('returnBook.noRevenue')
    );
    loadData();
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={D.PRIMARY} />
          <Text style={s.loadingText}>Loading shift...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasActiveShift = activeShift !== null &&
                         activeShift !== undefined &&
                         activeShift.status === 'open';

  const closedShiftsToday = todayShifts.filter((s) => s.status === 'closed' && !s.voided);
  const canCloseBizDay = (
    isAdmin &&
    businessDay?.status === 'open' &&
    !hasActiveShift &&
    closedShiftsToday.length > 0
  );

  const employeeName = activeShift?.employee_id === user?.user_id
    ? user?.username
    : activeShift ? `Employee #${activeShift.employee_id}` : null;

  return (
    <SafeAreaView style={s.safeArea}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerStore} numberOfLines={1}>
          {store?.name || store?.store_name || 'LottoMeter'}
        </Text>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{getInitials(user?.username)}</Text>
        </View>
      </View>

      {/* ── Offline Banner ──────────────────────────────────────────────── */}
      {isOffline && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineBannerText}>
            {pendingSyncCount > 0
              ? `⚠️ Offline — ${pendingSyncCount} scan${pendingSyncCount !== 1 ? 's' : ''} pending sync`
              : '⚠️ Offline Mode — working from local data'}
          </Text>
        </View>
      )}

      {/* ── Sync Banner ─────────────────────────────────────────────────── */}
      {!isOffline && pendingSyncCount > 0 && (
        <TouchableOpacity
          style={[s.syncBanner, isSyncing && s.dimmed]}
          onPress={handleSyncNow}
          disabled={isSyncing}
        >
          <Text style={s.syncBannerText}>
            {isSyncing ? 'Syncing...' : `↑ Sync Now (${pendingSyncCount} pending)`}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Scrollable Content ──────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={D.PRIMARY}
            colors={[D.PRIMARY]}
          />
        }
      >
        <TrialBannerComponent subscription={subscription} />

        {/* No active shift */}
        {!hasActiveShift && (
          <NoShiftCard
            businessDay={businessDay}
            onOpen={handleOpenShift}
            busy={busy}
            t={t}
          />
        )}

        {/* Active shift */}
        {hasActiveShift && (
          <ActiveShiftCard
            businessDay={businessDay}
            shift={activeShift}
            employeeName={employeeName}
            summary={summary}
            onClose={() => setCloseModalOpen(true)}
            onSellWholeBook={() => setWbSaleOpen(true)}
            onReturnBook={() => setReturnOpen(true)}
            onScan={() => navigation.navigate('Scan')}
            t={t}
          />
        )}

        {/* Books dashboard (admin only) */}
        {isAdmin && (
          <View style={s.dashCard}>
            <Text style={s.dashTitle}>Books Overview</Text>
            <BooksDashboard />
          </View>
        )}

        {/* Close business day */}
        {canCloseBizDay && (
          <TouchableOpacity
            style={[s.closeBizBtn, busy && s.dimmed]}
            onPress={handleCloseBizDay}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={D.ERROR} />
            ) : (
              <Text style={s.closeBizText}>{t('home.closeBizDay')}</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Debug: clear local data */}
        {isAdmin && (
          <TouchableOpacity
            onPress={async () => {
              const db = await getDb();
              await db.execAsync(`
                DELETE FROM local_business_days;
                DELETE FROM local_employee_shifts;
                DELETE FROM local_shift_books;
                DELETE FROM local_extra_sales;
                DELETE FROM sync_queue;
              `);
              Alert.alert('Done', 'Local data cleared');
              await loadData();
            }}
            style={s.debugBtn}
          >
            <Text style={s.debugBtnText}>🗑 Clear Local Data (Debug)</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <CloseShiftModal
        visible={closeModalOpen}
        mode="final"
        mainShiftId={activeShift?.id}
        subshiftId={activeShift?.id}
        shiftUuid={activeShift?.uuid}
        onCancel={() => setCloseModalOpen(false)}
        onSubmit={handleCloseShiftSubmit}
        closedSubshiftCount={closedShiftsToday.length}
        voidedSubshiftCount={todayShifts.filter((s) => s.voided).length}
      />

      <WholeBookSaleModal
        visible={wbSaleOpen}
        subshiftId={activeShift?.id}
        onCancel={() => setWbSaleOpen(false)}
        onSuccess={handleWbSuccess}
      />

      <ReturnBookModal
        visible={returnOpen}
        bookId={null}
        onCancel={() => setReturnOpen(false)}
        onSuccess={handleReturnSuccess}
      />
    </SafeAreaView>
  );
}

// ── NoShiftCard ───────────────────────────────────────────────────────────────

function NoShiftCard({ businessDay, onOpen, busy, t }) {
  return (
    <View style={s.noShiftCard}>
      {businessDay && (
        <Text style={s.noShiftDate}>
          {formatBusinessDate(businessDay.business_date)}
        </Text>
      )}
      <Text style={s.noShiftIcon}>🕐</Text>
      <Text style={s.noShiftTitle}>{t('home.noActiveShift')}</Text>
      <Text style={s.noShiftSub}>{t('home.noActiveShiftHint')}</Text>
      <TouchableOpacity
        style={[s.openShiftBtn, busy && s.dimmed]}
        onPress={onOpen}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.openShiftBtnText}>{t('home.openShift')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── ActiveShiftCard ───────────────────────────────────────────────────────────

function ActiveShiftCard({
  businessDay, shift, employeeName, summary,
  onClose, onSellWholeBook, onReturnBook, onScan, t,
}) {
  const duration   = getShiftDuration(shift.opened_at);
  const booksCount = getBooksCount(summary);
  const statusInfo = getShiftStatusInfo(summary);

  return (
    <View style={s.shiftCard}>

      {/* 3px PRIMARY top accent */}
      <View style={s.shiftCardBar} />

      {/* Header row */}
      <View style={s.shiftCardHeader}>
        <View style={s.shiftCardLeft}>
          <Text style={s.shiftCardTitle}>
            {t('home.shiftActive', { number: shift.shift_number })}
          </Text>
          <Text style={s.shiftCardSub}>
            {'Opened '}
            {formatLocalTime(shift.opened_at)}
            {employeeName ? ` by ${employeeName}` : ''}
          </Text>
        </View>
        <View style={s.activeBadge}>
          <Text style={s.activeBadgeText}>● Active</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statCell}>
          <Text style={s.statValue}>{duration}</Text>
          <Text style={s.statLabel}>Duration</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCell}>
          <Text style={s.statValue}>{booksCount}</Text>
          <Text style={s.statLabel}>Books</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCell}>
          <Text style={[s.statValueSm, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
          <Text style={s.statLabel}>Status</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={s.shiftActions}>

        {/* Primary: scan */}
        <TouchableOpacity style={s.scanBtn} onPress={onScan}>
          <Text style={s.scanBtnText}>📷  Scan Books</Text>
        </TouchableOpacity>

        {/* Secondary row */}
        <View style={s.secondaryRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={onSellWholeBook}>
            <Text style={s.secondaryBtnText}>{t('home.sellWholeBook')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={onReturnBook}>
            <Text style={s.secondaryBtnText}>{t('home.returnBook')}</Text>
          </TouchableOpacity>
        </View>

        {/* Danger: end shift */}
        <View style={s.dangerDivider} />
        <TouchableOpacity style={s.endShiftBtn} onPress={onClose}>
          <Text style={s.endShiftBtnText}>{t('home.endMainShift')}</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: D.BACKGROUND },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SP.md },
  loadingText: { fontSize: FS.sm, color: D.SUBTLE },
  dimmed: { opacity: 0.5 },

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
  headerStore: { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT, flex: 1, marginRight: SP.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: D.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: FS.sm, fontWeight: FW.bold, color: '#fff' },

  // offline
  offlineBanner:     { backgroundColor: D.WARNING, padding: 10, alignItems: 'center' },
  offlineBannerText: { color: '#fff', fontWeight: FW.semibold, fontSize: FS.sm, textAlign: 'center' },

  // sync
  syncBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: D.PRIMARY,
    borderRadius: BR.md,
    paddingVertical: 10,
    paddingHorizontal: SP.lg,
    marginHorizontal: SP.lg,
    marginTop: SP.sm,
    alignItems: 'center',
  },
  syncBannerText: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.PRIMARY },

  // scroll
  scroll: { paddingTop: SP.md },

  // ── NoShiftCard ────────────────────────────────────────────────────────────
  noShiftCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    padding: 32,
    paddingHorizontal: SP.xl,
    margin: SP.lg,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  noShiftDate: {
    fontSize: FS.xs,
    color: D.SUBTLE,
    fontWeight: FW.semibold,
    marginBottom: SP.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noShiftIcon:  { fontSize: 64, marginBottom: SP.md },
  noShiftTitle: { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT, marginBottom: SP.sm, textAlign: 'center' },
  noShiftSub:   { fontSize: FS.md, color: D.SUBTLE, textAlign: 'center', marginBottom: SP.xl },
  openShiftBtn: {
    height: 52,
    backgroundColor: D.PRIMARY,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  openShiftBtnText: { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },

  // ── ActiveShiftCard ────────────────────────────────────────────────────────
  shiftCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    marginHorizontal: SP.lg,
    marginBottom: SP.md,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  shiftCardBar: { height: 3, backgroundColor: D.PRIMARY },
  shiftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SP.lg,
  },
  shiftCardLeft:    { flex: 1, marginRight: SP.sm },
  shiftCardTitle:   { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT, marginBottom: 3 },
  shiftCardSub:     { fontSize: FS.sm, color: D.SUBTLE },
  activeBadge:      { backgroundColor: '#DCFCE7', paddingHorizontal: SP.sm, paddingVertical: 3, borderRadius: BR.full },
  activeBadgeText:  { fontSize: FS.xs, fontWeight: FW.semibold, color: D.SUCCESS },

  // stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: D.BACKGROUND,
    paddingVertical: SP.md,
    paddingHorizontal: SP.lg,
  },
  statCell:     { flex: 1, alignItems: 'center' },
  statValue:    { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT, marginBottom: 2 },
  statValueSm:  { fontSize: FS.sm, fontWeight: FW.bold, marginBottom: 2 },
  statLabel:    { fontSize: FS.xs, color: D.SUBTLE },
  statDivider:  { width: 1, backgroundColor: D.BORDER, marginVertical: SP.xs },

  // actions
  shiftActions:  { padding: SP.lg, gap: SP.sm },
  scanBtn: {
    height: 52,
    backgroundColor: D.PRIMARY,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanBtnText:      { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },
  secondaryRow:     { flexDirection: 'row', gap: SP.sm },
  secondaryBtn: {
    flex: 1,
    height: 44,
    backgroundColor: D.CARD,
    borderWidth: 1.5,
    borderColor: D.BORDER,
    borderRadius: BR.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT },
  dangerDivider:    { height: 1, backgroundColor: D.BORDER },
  endShiftBtn: {
    height: 44,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BR.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endShiftBtnText: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.ERROR },

  // ── Books dashboard card ───────────────────────────────────────────────────
  dashCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    marginHorizontal: SP.lg,
    marginBottom: SP.md,
    padding: SP.lg,
    ...CARD_SHADOW,
  },
  dashTitle: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT, marginBottom: SP.sm },

  // ── Close biz day ──────────────────────────────────────────────────────────
  closeBizBtn: {
    height: 44,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: BR.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SP.lg,
    marginBottom: SP.sm,
  },
  closeBizText: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.ERROR },

  // ── Debug button ───────────────────────────────────────────────────────────
  debugBtn: {
    padding: SP.md,
    marginHorizontal: SP.lg,
    marginBottom: SP.sm,
    backgroundColor: '#EF4444',
    borderRadius: BR.sm,
    alignItems: 'center',
  },
  debugBtnText: { color: '#fff', fontWeight: FW.semibold, fontSize: FS.sm },
});
