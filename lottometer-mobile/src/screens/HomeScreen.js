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
import { Colors, Radius, Shadow } from '../theme';
import { debugLocalDb } from '../offline/debugDb';

// ─── screen ─────────────────────────────────────────────────────────────────

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

  const [subscription, setSubscription]     = useState(null);

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

          const openShift = localShifts.find(s => s.status === 'open') || null;
          if (openShift) {
            setActiveShift({
              id: openShift.server_id,
              uuid: openShift.uuid,
              shift_number: openShift.shift_number,
              status: openShift.status,
              opened_at: openShift.opened_at,
              employee_id: openShift.employee_id,
            });

            const closeCount = await db.getFirstAsync(
              `SELECT COUNT(*) as count FROM local_shift_books
               WHERE shift_uuid = ? AND scan_type = 'close'`,
              [openShift.uuid]
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
        // OFFLINE PATH — shift already closed by CloseShiftModal; just refresh UI
        setCloseModalOpen(false);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <Text style={styles.greeting}>
          {t('home.greeting', { name: user?.username || '' })}
        </Text>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              {pendingSyncCount > 0
                ? `Offline — ${pendingSyncCount} scan(s) pending sync`
                : 'Offline Mode — working from local data'}
            </Text>
          </View>
        )}

        {!isOffline && pendingSyncCount > 0 && (
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.disabled]}
            onPress={handleSyncNow}
            disabled={isSyncing}
          >
            <Text style={styles.syncButtonText}>
              {isSyncing
                ? 'Syncing...'
                : `Sync Now (${pendingSyncCount} pending)`}
            </Text>
          </TouchableOpacity>
        )}

        <TrialBannerComponent subscription={subscription} />

        {isAdmin && <BooksDashboard />}

        {!hasActiveShift && (
          <NoShiftCard
            businessDay={businessDay}
            onOpen={handleOpenShift}
            busy={busy}
            t={t}
          />
        )}

        {hasActiveShift && (
          <ActiveShiftCard
            businessDay={businessDay}
            shift={activeShift}
            employeeName={employeeName}
            summary={summary}
            onClose={() => setCloseModalOpen(true)}
            onSellWholeBook={() => setWbSaleOpen(true)}
            onReturnBook={() => setReturnOpen(true)}
            t={t}
          />
        )}

        {canCloseBizDay && (
          <TouchableOpacity
            style={[styles.closeBizDayButton, busy && styles.disabled]}
            onPress={handleCloseBizDay}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={Colors.error} />
            ) : (
              <Text style={styles.closeBizDayText}>{t('home.closeBizDay')}</Text>
            )}
          </TouchableOpacity>
        )}

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
            style={{
              padding: 12,
              margin: 16,
              backgroundColor: '#EF4444',
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              🗑 Clear Local Data (Debug)
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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

// ─── STATE 1 — no open shift ─────────────────────────────────────────────────

function NoShiftCard({ businessDay, onOpen, busy, t }) {
  return (
    <View style={styles.card}>
      {businessDay && (
        <Text style={styles.dateText}>
          {formatBusinessDate(businessDay.business_date)}
        </Text>
      )}
      <Text style={styles.cardTitle}>{t('home.noActiveShift')}</Text>
      <Text style={styles.cardSubtitle}>{t('home.noActiveShiftHint')}</Text>
      <TouchableOpacity
        style={[styles.primaryButton, busy && styles.disabled]}
        onPress={onOpen}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('home.openShift')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── STATE 2 — shift is open ─────────────────────────────────────────────────

function ActiveShiftCard({ businessDay, shift, employeeName, summary, onClose, onSellWholeBook, onReturnBook, t }) {
  const pendingScans = summary?.books_pending_close ?? '—';

  return (
    <View style={styles.activeCard}>
      {businessDay && (
        <Text style={styles.dateText}>
          {formatBusinessDate(businessDay.business_date)}
        </Text>
      )}

      <View style={styles.shiftTitleRow}>
        <View style={styles.greenDot} />
        <Text style={styles.shiftTitle}>
          {t('home.shiftActive', { number: shift.shift_number })}
        </Text>
      </View>

      <View style={styles.divider} />
      <KV k={t('home.openedBy')} v={employeeName ?? '—'} />
      <KV k={t('home.started')} v={formatLocalTime(shift.opened_at)} />
      <KV
        k={t('home.pendingScans')}
        v={pendingScans}
        highlight={typeof pendingScans === 'number' && pendingScans > 0}
      />

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction} onPress={onSellWholeBook}>
          <Text style={styles.quickActionEmoji}>📚</Text>
          <Text style={styles.quickActionLabel}>{t('home.sellWholeBook')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={onReturnBook}>
          <Text style={styles.quickActionEmoji}>↩️</Text>
          <Text style={styles.quickActionLabel}>{t('home.returnBook')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.closeShiftButton} onPress={onClose}>
        <Text style={styles.closeShiftText}>{t('home.endMainShift')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── shared ──────────────────────────────────────────────────────────────────

function KV({ k, v, highlight }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvValue, highlight && styles.kvHighlight]}>{v}</Text>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting:      { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },

  dateText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },

  primaryButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.55 },

  activeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 20,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },

  shiftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    marginRight: 8,
  },
  shiftTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  kvKey:       { color: Colors.textSecondary, fontSize: 14 },
  kvValue:     { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  kvHighlight: { color: Colors.warning },

  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 16,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionEmoji: { fontSize: 22, marginBottom: 4 },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  closeShiftButton: {
    backgroundColor: Colors.error,
    padding: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  closeShiftText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  closeBizDayButton: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error,
    marginTop: 4,
  },
  closeBizDayText: { color: Colors.error, fontSize: 15, fontWeight: '600' },

  offlineBanner: {
    backgroundColor: '#D97706',
    borderRadius: Radius.sm,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  offlineBannerText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  syncButton: {
    backgroundColor: '#2F80ED',
    borderRadius: Radius.sm,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  syncButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
