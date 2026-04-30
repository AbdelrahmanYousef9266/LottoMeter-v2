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

import { useAuth } from '../context/AuthContext';
import { openShift, listShifts, closeShift, getShiftSummary } from '../api/shifts';
import { getTodaysBusinessDay, closeBusinessDay } from '../api/businessDays';
import CloseShiftModal from '../components/CloseShiftModal';
import WholeBookSaleModal from '../components/WholeBookSaleModal';
import ReturnBookModal from '../components/ReturnBookModal';
import BooksDashboard from '../components/BooksDashboard';
import { formatBusinessDate, formatLocalTime } from '../utils/dateTime';

// ─── screen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy]             = useState(false);

  // core state
  const [businessDay, setBusinessDay]   = useState(null);
  const [todayShifts, setTodayShifts]   = useState([]);
  const [activeShift, setActiveShift]   = useState(null); // shift with status === 'open'
  const [summary, setSummary]           = useState(null);

  // modal visibility
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [wbSaleOpen, setWbSaleOpen]         = useState(false);
  const [returnOpen, setReturnOpen]         = useState(false);

  // ── data loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      // 1. today's business day (auto-creates if missing)
      const bd = await getTodaysBusinessDay();
      setBusinessDay(bd);

      // 2. all shifts for today
      const { shifts } = await listShifts({ business_day_id: bd.id });
      setTodayShifts(shifts);

      // 3. find the open shift (if any)
      const open = shifts.find((s) => s.status === 'open' && !s.voided) || null;
      setActiveShift(open);

      // 4. load pending-scans summary for the open shift
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
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }, [loadData])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  // ── actions ────────────────────────────────────────────────────────────────

  async function handleOpenShift() {
    setBusy(true);
    try {
      await openShift();
      await loadData();
      navigation.navigate('Scan', { scanType: 'open', justOpened: true });
    } catch (err) {
      Alert.alert(t('home.couldNotOpenShift'), err.message || t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseShiftSubmit(payload) {
    if (!activeShift) return;
    try {
      await closeShift(activeShift.id, payload);
      setCloseModalOpen(false);
      await loadData();
      Alert.alert(t('home.mainShiftClosed'), t('home.mainShiftClosedHint'));
    } catch (err) {
      if (err.code === 'BOOKS_NOT_CLOSED') {
        Alert.alert(t('closeShift.booksNotClosed'), err.message || t('closeShift.booksNotClosedHint'));
      } else {
        Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
      }
      throw err; // let CloseShiftModal re-enable its submit button
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
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      </SafeAreaView>
    );
  }

  const closedShiftsToday = todayShifts.filter((s) => s.status === 'closed' && !s.voided);
  const canCloseBizDay = (
    isAdmin &&
    businessDay?.status === 'open' &&
    !activeShift &&
    closedShiftsToday.length > 0
  );

  const employeeName = activeShift?.employee_id === user?.user_id
    ? user?.username
    : activeShift ? `Employee #${activeShift.employee_id}` : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Text style={styles.greeting}>
          {t('home.greeting', { name: user?.username || '' })}
        </Text>

        {isAdmin && <BooksDashboard />}

        {activeShift ? (
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
        ) : (
          <NoShiftCard
            businessDay={businessDay}
            onOpen={handleOpenShift}
            busy={busy}
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
              <ActivityIndicator color="#dc2626" />
            ) : (
              <Text style={styles.closeBizDayText}>{t('home.closeBizDay')}</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <CloseShiftModal
        visible={closeModalOpen}
        mode="final"
        mainShiftId={activeShift?.id}
        subshiftId={activeShift?.id}
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

// ─── STATE 1 — no open shift ────────────────────────────────────────────────

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
      {/* date header */}
      {businessDay && (
        <Text style={styles.dateText}>
          {formatBusinessDate(businessDay.business_date)}
        </Text>
      )}

      {/* shift identity row */}
      <View style={styles.shiftTitleRow}>
        <View style={styles.greenDot} />
        <Text style={styles.shiftTitle}>
          {t('home.shiftActive', { number: shift.shift_number })}
        </Text>
      </View>

      {/* shift detail rows */}
      <View style={styles.divider} />
      <KV k={t('home.openedBy')} v={employeeName ?? '—'} />
      <KV k={t('home.started')} v={formatLocalTime(shift.opened_at)} />
      <KV
        k={t('home.pendingScans')}
        v={pendingScans}
        highlight={typeof pendingScans === 'number' && pendingScans > 0}
      />

      {/* quick actions */}
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

      {/* close shift */}
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
  container:     { flex: 1, backgroundColor: '#f4f5f7' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting:      { fontSize: 22, fontWeight: '700', color: '#222', marginBottom: 16 },

  // ── shared card base ──────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  dateText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },

  primaryButton: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.55 },

  // ── active shift card — distinct with green left border ───────────────────
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  shiftTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a2e1a',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eee',
    marginBottom: 10,
  },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  kvKey:       { color: '#666', fontSize: 14 },
  kvValue:     { color: '#222', fontSize: 14, fontWeight: '600' },
  kvHighlight: { color: '#d97706' }, // amber when pending scans > 0

  // ── quick actions inside active card ─────────────────────────────────────
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 16,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#f4f5f7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickActionEmoji: { fontSize: 24, marginBottom: 4 },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: '#333' },

  // ── close shift button ────────────────────────────────────────────────────
  closeShiftButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeShiftText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ── admin: close business day ─────────────────────────────────────────────
  closeBizDayButton: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#dc2626',
    marginTop: 4,
  },
  closeBizDayText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
});
