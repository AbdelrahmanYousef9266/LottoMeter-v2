import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { listBusinessDays } from '../api/businessDays';
import { listShifts } from '../api/shifts';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../offline/db';
import EmptyState from '../components/EmptyState';
import { formatDayLabel, formatLocalTime } from '../utils/dateTime';
import { Colors, Radius, Shadow } from '../theme';

function fmt$(v) {
  if (v === null || v === undefined) return '$0.00';
  const n = parseFloat(v);
  return Number.isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

// Returns variance as a number, or null when shifts aren't loaded yet.
// Closed days: use server total_variance.
// Open days / offline: sum difference from closed shifts on day.shifts.
function getDayVariance(day) {
  if (day.status === 'closed' && day.total_variance != null) {
    return parseFloat(day.total_variance);
  }
  const closed = (day.shifts || []).filter(
    s => s.status === 'closed' && s.difference != null
  );
  if (closed.length === 0) return null;
  return closed.reduce((sum, s) => sum + parseFloat(s.difference || 0), 0);
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, isOffline, store } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessDays, setBusinessDays] = useState([]);
  const [expandedDayId, setExpandedDayId] = useState(null);

  const shiftsCacheRef = useRef({});
  const [cacheVersion, setCacheVersion] = useState(0);

  const loadDays = useCallback(async () => {
    try {
      if (isOffline) {
        const db = await getDb();

        const allShifts = await db.getAllAsync(
          'SELECT id, uuid, business_day_uuid, shift_number, status, store_id FROM local_employee_shifts WHERE store_id = ?',
          [store?.store_id]
        );
        console.log('[history] all shifts:', JSON.stringify(allShifts));

        const allDays = await db.getAllAsync(
          'SELECT id, uuid, business_date, status, store_id FROM local_business_days WHERE store_id = ?',
          [store?.store_id]
        );
        console.log('[history] all days:', JSON.stringify(allDays));

        const localDays = await db.getAllAsync(
          `SELECT DISTINCT business_date,
                  MAX(id) as id,
                  uuid, store_id, status,
                  opened_at, closed_at, total_sales, total_variance
           FROM local_business_days
           WHERE store_id = ?
           GROUP BY business_date
           ORDER BY business_date DESC`,
          [store?.store_id]
        );

        const daysWithShifts = await Promise.all(
          localDays.map(async (day) => {
            const shifts = await db.getAllAsync(
              `SELECT DISTINCT shift_number,
                      MAX(id) as id,
                      uuid, status, opened_at, closed_at,
                      cash_in_hand, gross_sales, cash_out, cancels,
                      tickets_total, expected_cash, difference,
                      shift_status, employee_id, business_day_uuid
               FROM local_employee_shifts
               WHERE business_day_uuid = ?
               GROUP BY shift_number
               ORDER BY shift_number ASC`,
              [day.uuid]
            );
            return {
              id: day.id,
              uuid: day.uuid,
              business_date: day.business_date,
              status: day.status,
              total_sales: day.total_sales,
              total_variance: day.total_variance,
              shifts: shifts.map(s => ({
                id: s.id,
                uuid: s.uuid,
                shift_number: s.shift_number,
                status: s.status,
                opened_at: s.opened_at,
                closed_at: s.closed_at,
                cash_in_hand: s.cash_in_hand,
                gross_sales: s.gross_sales,
                cash_out: s.cash_out,
                cancels: s.cancels,
                tickets_total: s.tickets_total,
                expected_cash: s.expected_cash,
                difference: s.difference,
                shift_status: s.shift_status,
                employee_id: s.employee_id,
              })),
            };
          })
        );

        // Pre-populate shifts cache so handleDayPress skips API calls offline
        daysWithShifts.forEach(day => {
          shiftsCacheRef.current[day.id] = { shifts: day.shifts, loading: false };
        });
        setBusinessDays(daysWithShifts);
        return;
      }

      const data = await listBusinessDays();
      const sorted = (data.business_days || []).sort((a, b) =>
        b.business_date.localeCompare(a.business_date)
      );

      // Preload shifts for all days so variance shows without expanding
      const daysWithShifts = await Promise.all(
        sorted.map(async (day) => {
          try {
            const res = await listShifts({ business_day_id: day.id });
            return { ...day, shifts: res.shifts || [] };
          } catch {
            return { ...day, shifts: [] };
          }
        })
      );

      // Pre-populate cache so handleDayPress skips the API call on expand
      daysWithShifts.forEach(day => {
        shiftsCacheRef.current[day.id] = { shifts: day.shifts, loading: false };
      });
      setCacheVersion(v => v + 1);
      setBusinessDays(daysWithShifts);
    } catch (err) {
      if (!isOffline) {
        Alert.alert(t('history.errorLoadingDays'), err.message || t('common.tryAgain'));
      }
    }
  }, [t, isOffline, store]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDays().finally(() => setLoading(false));
    }, [loadDays])
  );

  async function handleRefresh() {
    setRefreshing(true);
    shiftsCacheRef.current = {};
    setCacheVersion((v) => v + 1);
    await loadDays();
    setRefreshing(false);
  }

  async function handleDayPress(day) {
    if (expandedDayId === day.id) {
      setExpandedDayId(null);
      return;
    }
    setExpandedDayId(day.id);

    if (shiftsCacheRef.current[day.id]) return;

    shiftsCacheRef.current[day.id] = { shifts: [], loading: true };
    setCacheVersion((v) => v + 1);

    try {
      const data = await listShifts({ business_day_id: day.id });
      shiftsCacheRef.current[day.id] = { shifts: data.shifts || [], loading: false };
    } catch (err) {
      shiftsCacheRef.current[day.id] = { shifts: [], loading: false };
      Alert.alert(t('history.errorLoadingShifts'), err.message || t('common.tryAgain'));
    }
    setCacheVersion((v) => v + 1);
  }

  function renderDay({ item: day }) {
    return (
      <DayCard
        day={day}
        isExpanded={expandedDayId === day.id}
        cached={shiftsCacheRef.current[day.id]}
        user={user}
        t={t}
        onPress={() => handleDayPress(day)}
        onShiftPress={(shiftId) =>
          navigation.navigate('ReportDetail', { shiftId })
        }
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('history.title')}</Text>
        </View>
        <DaySkeleton />
        <DaySkeleton />
        <DaySkeleton />
        <DaySkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={businessDays}
        keyExtractor={(d) => d.uuid || String(d.id)}
        renderItem={renderDay}
        extraData={[expandedDayId, cacheVersion]}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('history.title')}</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title={t('history.emptyDaysTitle')}
            subtitle={t('history.emptyDaysSubtitle')}
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── DayCard ─────────────────────────────────────────────────────────────────

function DayCard({ day, isExpanded, cached, user, t, onPress, onShiftPress }) {
  const isOpen = day.status === 'open';
  const shifts = cached?.shifts ?? [];
  const shiftsLoading = cached?.loading ?? false;

  const variance = getDayVariance(day);
  let varianceStyle = styles.varianceNeutral;
  let varianceLabel = '—';
  if (variance !== null) {
    const abs = Math.abs(variance).toFixed(2);
    if (variance === 0) {
      varianceStyle = styles.varianceCorrect;
      varianceLabel = `$${abs} · Correct`;
    } else if (variance > 0) {
      varianceStyle = styles.varianceOver;
      varianceLabel = `+$${abs} · Over`;
    } else {
      varianceStyle = styles.varianceShort;
      varianceLabel = `-$${abs} · Short`;
    }
  }

  return (
    <View style={[styles.dayCard, isOpen ? styles.dayCardOpen : styles.dayCardClosed]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayDate}>{formatDayLabel(day.business_date)}</Text>
            {day.total_sales != null && parseFloat(day.total_sales) !== 0 && (
              <Text style={styles.daySales}>{fmt$(day.total_sales)}</Text>
            )}
            <Text style={[styles.dayVariance, varianceStyle]}>{varianceLabel}</Text>
          </View>
          <View style={styles.dayRight}>
            <View style={[styles.dayBadge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={[styles.dayBadgeText, isOpen ? styles.badgeOpenText : styles.badgeClosedText]}>
                {t(isOpen ? 'history.statusOpen' : 'history.statusClosed')}
              </Text>
            </View>
            <Text style={[styles.chevron, isExpanded && styles.chevronExpanded]}>{'▼'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.shiftsContainer}>
          <View style={styles.shiftsDivider} />
          {shiftsLoading ? (
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={styles.shiftsLoader}
            />
          ) : shifts.length === 0 ? (
            <Text style={styles.noShiftsText}>{t('history.noShifts')}</Text>
          ) : (
            shifts.map((shift) => (
              <ShiftRow
                key={shift.uuid || String(shift.id)}
                shift={shift}
                user={user}
                t={t}
                onPress={() => onShiftPress(shift.id)}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ─── ShiftRow ─────────────────────────────────────────────────────────────────

function ShiftRow({ shift, user, t, onPress }) {
  const isOpen = shift.status === 'open';
  const isVoided = shift.voided;

  let badgeText, badgeBg, badgeColor;

  if (isVoided) {
    badgeText = t('history.statusVoided');
    badgeBg = Colors.errorBg;
    badgeColor = Colors.error;
  } else if (isOpen) {
    badgeText = t('history.statusActive');
    badgeBg = Colors.primaryLight;
    badgeColor = Colors.primary;
  } else if (shift.shift_status === 'correct') {
    badgeText = t('history.statusCorrect');
    badgeBg = Colors.successBg;
    badgeColor = Colors.success;
  } else if (shift.shift_status === 'over') {
    badgeText = t('history.statusOver');
    badgeBg = Colors.warningBg;
    badgeColor = Colors.warning;
  } else if (shift.shift_status === 'short') {
    badgeText = t('history.statusShort');
    badgeBg = Colors.errorBg;
    badgeColor = Colors.error;
  } else {
    badgeText = '—';
    badgeBg = Colors.border;
    badgeColor = Colors.textMuted;
  }

  const openedBy =
    shift.employee_id === user?.user_id
      ? user?.username
      : `#${shift.employee_id}`;

  const endLabel = isOpen
    ? t('history.statusActive')
    : formatLocalTime(shift.closed_at);

  return (
    <TouchableOpacity style={styles.shiftRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.shiftLeft}>
        <Text style={styles.shiftNumber}>
          {t('history.shiftNumber', { number: shift.shift_number })}
        </Text>
        <Text style={styles.shiftTime}>
          {`${formatLocalTime(shift.opened_at)} → ${endLabel}`}
        </Text>
        <Text style={styles.shiftOpenedBy}>{openedBy}</Text>
      </View>
      <View style={[styles.shiftBadge, { backgroundColor: badgeBg }]}>
        <Text style={[styles.shiftBadgeText, { color: badgeColor }]}>
          {badgeText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function DaySkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonLineLong} />
        <View style={styles.skeletonBadge} />
      </View>
      <View style={styles.skeletonLineShort} />
    </Animated.View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  titleRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  dayCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  dayCardOpen:   { borderLeftColor: Colors.success },
  dayCardClosed: { borderLeftColor: Colors.border },

  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  dayInfo:  { flex: 1, marginRight: 8 },
  dayDate:  { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  daySales: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2 },

  dayVariance:      { fontSize: 12, fontWeight: '600' },
  varianceCorrect:  { color: Colors.success },
  varianceOver:     { color: Colors.warning },
  varianceShort:    { color: Colors.error },
  varianceNeutral:  { color: Colors.textMuted },

  dayRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  dayBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeOpen:       { backgroundColor: Colors.successBg },
  badgeClosed:     { backgroundColor: Colors.border },
  dayBadgeText:    { fontSize: 12, fontWeight: '700' },
  badgeOpenText:   { color: Colors.success },
  badgeClosedText: { color: Colors.textSecondary },

  chevron:         { fontSize: 12, color: Colors.textMuted, marginLeft: 2 },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },

  shiftsContainer: { paddingBottom: 6 },
  shiftsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  shiftsLoader:  { paddingVertical: 14 },
  noShiftsText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },

  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  shiftLeft:      { flex: 1, marginRight: 10 },
  shiftNumber:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  shiftTime:      { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  shiftOpenedBy:  { fontSize: 11, color: Colors.textMuted },

  shiftBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  shiftBadgeText: { fontSize: 11, fontWeight: '700' },

  skeletonCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: 10,
    marginHorizontal: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.border,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  skeletonLineLong: {
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.border,
    flex: 0.65,
  },
  skeletonBadge: {
    height: 22,
    width: 54,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  skeletonLineShort: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.inputBg,
    width: '35%',
  },
});
