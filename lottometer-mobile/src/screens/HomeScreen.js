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
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import {
  openShift,
  listShifts,
  getShift,
  handoverSubshift,
  closeMainShift,
} from '../api/shifts';
import CloseShiftModal from '../components/CloseShiftModal';
import WholeBookSaleModal from '../components/WholeBookSaleModal';
import ReturnBookModal from '../components/ReturnBookModal';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shiftDetail, setShiftDetail] = useState(null);

  const [closeMode, setCloseMode] = useState(null);
  const [wbSaleOpen, setWbSaleOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const loadCurrentShift = useCallback(async () => {
    try {
      const { shifts } = await listShifts({ status: 'open', limit: 1 });
      if (shifts.length === 0) {
        setShiftDetail(null);
        return;
      }
      const detail = await getShift(shifts[0].shift_id);
      setShiftDetail(detail);
    } catch (err) {
      Alert.alert(t('home.errorLoadingShift'), err.message || t('common.networkError'));
      setShiftDetail(null);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCurrentShift().finally(() => setLoading(false));
    }, [loadCurrentShift])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadCurrentShift();
    setRefreshing(false);
  }

  async function handleOpenShift() {
    setBusy(true);
    try {
      await openShift();
      await loadCurrentShift();
    } catch (err) {
      Alert.alert(t('home.couldNotOpenShift'), err.message || t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  async function handleHandoverSubmit(payload) {
    if (!shiftDetail?.main_shift?.shift_id) return;
    try {
      await handoverSubshift(shiftDetail.main_shift.shift_id, payload);
      setCloseMode(null);
      await loadCurrentShift();
      Alert.alert(t('home.subshiftEnded'), t('home.subshiftEndedHint'));
    } catch (err) {
      handleCloseError(err);
      throw err;
    }
  }

  async function handleFinalCloseSubmit(payload) {
    if (!shiftDetail?.main_shift?.shift_id) return;
    try {
      await closeMainShift(shiftDetail.main_shift.shift_id, payload);
      setCloseMode(null);
      await loadCurrentShift();
      Alert.alert(t('home.mainShiftClosed'), t('home.mainShiftClosedHint'));
    } catch (err) {
      handleCloseError(err);
      throw err;
    }
  }

  function handleCloseError(err) {
    if (err.code === 'BOOKS_NOT_CLOSED') {
      Alert.alert(t('closeShift.booksNotClosed'), err.message || t('closeShift.booksNotClosedHint'));
    } else {
      Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
    }
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
    loadCurrentShift();
  }

  function handleReturnSuccess(result) {
    setReturnOpen(false);
    Alert.alert(
      t('returnBook.bookReturned'),
      result.close_scan_recorded
        ? t('returnBook.revenuePreserved', { position: result.position })
        : t('returnBook.noRevenue')
    );
    loadCurrentShift();
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

  const openSubshiftId = shiftDetail
    ? shiftDetail.subshifts?.find((s) => s.is_shift_open)?.shift_id
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.greeting}>
          {t('home.greeting', { name: user?.username || '' })}
        </Text>

        {!shiftDetail ? (
          <NoShiftView onOpen={handleOpenShift} busy={busy} t={t} />
        ) : (
          <ActiveShiftView
            shiftDetail={shiftDetail}
            onHandover={() => setCloseMode('handover')}
            onFinalClose={() => setCloseMode('final')}
            onSellWholeBook={() => setWbSaleOpen(true)}
            onReturnBook={() => setReturnOpen(true)}
            t={t}
          />
        )}
      </ScrollView>

      <CloseShiftModal
        visible={closeMode !== null}
        mode={closeMode || 'handover'}
        mainShiftId={shiftDetail?.main_shift?.shift_id}
        subshiftId={openSubshiftId}
        onCancel={() => setCloseMode(null)}
        onSubmit={
          closeMode === 'final' ? handleFinalCloseSubmit : handleHandoverSubmit
        }
      />

      <WholeBookSaleModal
        visible={wbSaleOpen}
        subshiftId={openSubshiftId}
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

function NoShiftView({ onOpen, busy, t }) {
  return (
    <View style={styles.card}>
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

function ActiveShiftView({
  shiftDetail,
  onHandover,
  onFinalClose,
  onSellWholeBook,
  onReturnBook,
  t,
}) {
  const main = shiftDetail.main_shift;
  const subs = shiftDetail.subshifts || [];
  const currentPending = shiftDetail.current_subshift_pending;
  const currentSub = subs.find((s) => s.is_shift_open);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.shiftHeader}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{t('home.active')}</Text>
          </View>
          <Text style={styles.shiftId}>
            {t('home.shiftId', { id: main.shift_id })}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{t('home.mainShift')}</Text>
        <KV k={t('home.startedBy')} v={main.opened_by?.username} />
        <KV k={t('home.started')} v={formatTime(main.shift_start_time)} />
        <KV k={t('home.subshifts')} v={subs.length} />
      </View>

      {currentSub && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('home.subshift', { number: currentSub.shift_number })}
          </Text>
          <KV k={t('home.openedBy')} v={currentSub.opened_by?.username} />
          <KV k={t('home.started')} v={formatTime(currentSub.shift_start_time)} />
          {currentPending && (
            <KV
              k={t('home.pendingScans')}
              v={currentPending.pending_scans?.length || 0}
            />
          )}
          {currentPending && !currentPending.is_initialized && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{t('home.pendingBanner')}</Text>
            </View>
          )}
        </View>
      )}

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

      <View style={styles.actions}>
        <TouchableOpacity style={styles.handoverButton} onPress={onHandover}>
          <Text style={styles.handoverText}>{t('home.endSubshift')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endShiftButton} onPress={onFinalClose}>
          <Text style={styles.endShiftText}>{t('home.endMainShift')}</Text>
        </TouchableOpacity>
      </View>
    </>
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

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#222', marginBottom: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 8 },
  cardSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },

  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  shiftId: { marginLeft: 'auto', color: '#888', fontSize: 14 },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  kvKey: { color: '#666', fontSize: 14 },
  kvValue: { color: '#222', fontSize: 14, fontWeight: '600' },

  banner: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  bannerText: { color: '#92400e', fontSize: 13 },

  primaryButton: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },

  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickAction: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionEmoji: { fontSize: 28, marginBottom: 4 },
  quickActionLabel: { fontSize: 13, fontWeight: '600', color: '#333' },

  actions: { marginTop: 4 },
  handoverButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  handoverText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
  endShiftButton: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  endShiftText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});