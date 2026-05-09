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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { listBusinessDays } from '../api/businessDays';
import { listShifts } from '../api/shifts';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../offline/db';
import { formatDayLabel, formatLocalTime } from '../utils/dateTime';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// ── helpers ────────────────────────────────────────────────────────────────────

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

function getDayStatusBadge(day) {
  const today = new Date().toISOString().split('T')[0];
  const isToday = day.business_date === today;

  if (day.status === 'open' && isToday) {
    return { label: 'Active', color: '#0077CC', bg: '#EFF6FF' };
  }
  if (day.status === 'open' && !isToday) {
    return { label: 'Incomplete', color: '#D97706', bg: '#FEF9EE' };
  }
  if (day.status === 'incomplete') {
    return { label: 'Incomplete', color: '#D97706', bg: '#FEF9EE' };
  }
  if (day.status === 'closed') {
    const variance = getDayVariance(day);
    if (variance === null) return { label: 'Closed',      color: '#64748B', bg: '#F1F5F9' };
    if (variance === 0)    return { label: 'Correct',     color: '#16A34A', bg: '#F0FDF4' };
    if (variance > 0)      return { label: 'Over',        color: '#D97706', bg: '#FEF9EE' };
    return                        { label: 'Short',       color: '#DC2626', bg: '#FEF2F2' };
  }
  return { label: day.status, color: '#64748B', bg: '#F1F5F9' };
}

function getDayTimeRange(day) {
  const shifts = day.shifts || [];
  if (shifts.length === 0) return '—';
  const opened = shifts.map(s => s.opened_at).filter(Boolean).sort();
  if (opened.length === 0) return '—';
  const start = formatLocalTime(opened[0]);
  if (shifts.some(s => s.status === 'open')) {
    const today = new Date().toISOString().split('T')[0];
    return day.business_date === today ? `${start} – Active` : `${start} – Incomplete`;
  }
  const closed = shifts.map(s => s.closed_at).filter(Boolean).sort();
  if (closed.length === 0) return start;
  return `${start} – ${formatLocalTime(closed[closed.length - 1])}`;
}

function getShiftVariance(shift, businessDate) {
  if (shift.voided) return { color: D.ERROR, label: 'Voided' };
  if (shift.status === 'open') {
    const today = new Date().toISOString().split('T')[0];
    if (businessDate && businessDate !== today) {
      return { color: D.WARNING, label: 'Incomplete' };
    }
    return { color: D.PRIMARY, label: 'Active' };
  }
  if (shift.status === 'incomplete') return { color: D.WARNING, label: 'Incomplete' };
  if (shift.shift_status === 'correct') return { color: D.SUCCESS, label: 'Correct' };
  if (shift.shift_status === 'over') {
    const n = Math.abs(parseFloat(shift.difference || 0));
    return { color: D.WARNING, label: `+$${n.toFixed(2)}` };
  }
  if (shift.shift_status === 'short') {
    const n = Math.abs(parseFloat(shift.difference || 0));
    return { color: D.ERROR, label: `-$${n.toFixed(2)}` };
  }
  return { color: D.SUBTLE, label: '—' };
}

function formatShiftTime(shift, businessDate) {
  const start = formatLocalTime(shift.opened_at);
  if (shift.status === 'open') {
    const today = new Date().toISOString().split('T')[0];
    if (businessDate && businessDate !== today) return `${start} – Incomplete`;
    return `${start} – Active`;
  }
  if (shift.status === 'incomplete') {
    if (!shift.closed_at) return `${start} – Incomplete`;
    const end = formatLocalTime(shift.closed_at);
    const hrs = Math.round((new Date(shift.closed_at) - new Date(shift.opened_at)) / 3_600_000);
    return `${start} – ${end}${hrs > 0 ? ` · ${hrs}h` : ''}`;
  }
  const end = formatLocalTime(shift.closed_at);
  if (!shift.opened_at || !shift.closed_at) return `${start} – ${end}`;
  const hrs = Math.round((new Date(shift.closed_at) - new Date(shift.opened_at)) / 3_600_000);
  return `${start} – ${end}${hrs > 0 ? ` · ${hrs}h` : ''}`;
}

// ── screen ─────────────────────────────────────────────────────────────────────

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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  // ── loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('history.title')}</Text>
          <FilterIcon />
        </View>
        <View style={s.skeletonWrap}>
          <DaySkeleton />
          <DaySkeleton />
          <DaySkeleton />
        </View>
      </SafeAreaView>
    );
  }

  // ── main ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('history.title')}</Text>
        <FilterIcon />
      </View>

      <FlatList
        data={businessDays}
        keyExtractor={(d) => d.uuid || String(d.id)}
        renderItem={renderDay}
        extraData={[expandedDayId, cacheVersion]}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={D.PRIMARY}
            colors={[D.PRIMARY]}
          />
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={s.emptyTitle}>No history yet</Text>
            <Text style={s.emptySub}>Closed shifts will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── FilterIcon ─────────────────────────────────────────────────────────────────

function FilterIcon() {
  return (
    <TouchableOpacity style={s.filterBtn} activeOpacity={0.6} onPress={() => {}}>
      <View style={s.filterLine18} />
      <View style={s.filterLine13} />
      <View style={s.filterLine8} />
    </TouchableOpacity>
  );
}

// ── DayCard ───────────────────────────────────────────────────────────────────

function DayCard({ day, isExpanded, cached, user, t, onPress, onShiftPress }) {
  const shifts   = cached?.shifts ?? day.shifts ?? [];
  const shiftsLoading = cached?.loading ?? false;
  const badge    = getDayStatusBadge(day);
  const year     = day.business_date?.split('-')[0] ?? '';
  const timeRange = getDayTimeRange({ ...day, shifts });

  return (
    <View style={s.dayCard}>

      {/* ── Header (tappable) ─────────────────────────────────────────── */}
      <TouchableOpacity style={s.dayHeader} onPress={onPress} activeOpacity={0.7}>
        <View style={s.dayLeft}>
          <Text style={s.dayDate}>{formatDayLabel(day.business_date)}</Text>
          {!!year && <Text style={s.dayYear}>{year}</Text>}
        </View>
        <View style={s.dayRight}>
          {badge && (
            <View style={[s.dayBadge, { backgroundColor: badge.bg }]}>
              <Text style={[s.dayBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          )}
          <Text style={[s.chevron, isExpanded && s.chevronExpanded]}>›</Text>
        </View>
      </TouchableOpacity>

      {/* ── Summary Row (always visible) ──────────────────────────────── */}
      <View style={s.summaryRow}>
        <View style={s.statCell}>
          <Text style={s.statLabel}>Total Sales</Text>
          <Text style={s.statValue}>{fmt$(day.total_sales)}</Text>
        </View>
        <View style={[s.statCell, s.statCellCenter]}>
          <Text style={s.statLabel}>Shifts</Text>
          <Text style={s.statValue}>{shifts.length}</Text>
        </View>
        <View style={[s.statCell, s.statCellRight]}>
          <Text style={[s.statLabel, { textAlign: 'right' }]}>Hours</Text>
          <Text style={[s.statValueSm, { textAlign: 'right' }]}>{timeRange}</Text>
        </View>
      </View>

      {/* ── Shifts Section (expanded only) ────────────────────────────── */}
      {isExpanded && (
        <View style={s.shiftsSection}>
          <View style={s.shiftsDivider} />
          {shiftsLoading ? (
            <ActivityIndicator
              size="small"
              color={D.PRIMARY}
              style={s.shiftsLoader}
            />
          ) : shifts.length === 0 ? (
            <Text style={s.noShiftsText}>{t('history.noShifts')}</Text>
          ) : (
            shifts.map((shift, idx) => (
              <ShiftRow
                key={shift.uuid || String(shift.id)}
                shift={shift}
                isLast={idx === shifts.length - 1}
                user={user}
                t={t}
                onPress={() => onShiftPress(shift.id)}
                businessDate={day.business_date}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ── ShiftRow ──────────────────────────────────────────────────────────────────

function ShiftRow({ shift, isLast, user, t, onPress, businessDate }) {
  const variance  = getShiftVariance(shift, businessDate);
  const timeLabel = formatShiftTime(shift, businessDate);

  return (
    <TouchableOpacity
      style={[s.shiftRow, !isLast && s.shiftRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left: circle + info */}
      <View style={s.shiftLeft}>
        <View style={s.shiftCircle}>
          <Text style={s.shiftCircleText}>{shift.shift_number}</Text>
        </View>
        <View style={s.shiftInfo}>
          <Text style={s.shiftName}>
            {t('history.shiftNumber', { number: shift.shift_number })}
          </Text>
          <Text style={s.shiftTime}>{timeLabel}</Text>
        </View>
      </View>

      {/* Right: amount + variance + chevron */}
      <View style={s.shiftRight}>
        <View style={s.shiftRightInfo}>
          <Text style={s.shiftSales}>{fmt$(shift.gross_sales)}</Text>
          <View style={s.varRow}>
            <View style={[s.varDot, { backgroundColor: variance.color }]} />
            <Text style={[s.varLabel, { color: variance.color }]}>
              {variance.label}
            </Text>
          </View>
        </View>
        <Text style={s.shiftChevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── DaySkeleton ───────────────────────────────────────────────────────────────

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
    <Animated.View style={[s.skelCard, { opacity }]}>
      {/* header placeholder */}
      <View style={s.skelHeader}>
        <View style={s.skelLeft}>
          <View style={s.skelDateBar} />
          <View style={s.skelYearBar} />
        </View>
        <View style={s.skelBadge} />
      </View>
      {/* summary placeholder */}
      <View style={s.skelSummary}>
        <View style={s.skelStat} />
        <View style={s.skelStat} />
        <View style={s.skelStat} />
      </View>
    </Animated.View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: D.BACKGROUND },

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
  headerTitle: { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT },

  // filter icon — three horizontal bars, decreasing width (funnel shape)
  filterBtn:    { padding: SP.sm, gap: 4 },
  filterLine18: { width: 18, height: 2, backgroundColor: D.TEXT, borderRadius: 1 },
  filterLine13: { width: 13, height: 2, backgroundColor: D.TEXT, borderRadius: 1 },
  filterLine8:  { width: 8,  height: 2, backgroundColor: D.TEXT, borderRadius: 1 },

  // list
  listContent: { paddingHorizontal: SP.lg, paddingTop: SP.sm, paddingBottom: 32 },
  skeletonWrap: { padding: SP.lg, gap: SP.md },

  // empty state
  emptyWrap:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: SP.xl },
  emptyEmoji: { fontSize: 64, marginBottom: SP.md },
  emptyTitle: { fontSize: FS.lg, fontWeight: FW.semibold, color: D.TEXT, marginBottom: SP.sm },
  emptySub:   { fontSize: FS.md, color: D.SUBTLE, textAlign: 'center' },

  // day card
  dayCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    marginBottom: SP.md,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },

  // day card header
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SP.lg,
  },
  dayLeft:  { flex: 1, marginRight: SP.sm },
  dayDate:  { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT, marginBottom: 2 },
  dayYear:  { fontSize: FS.sm, color: D.SUBTLE },
  dayRight: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },

  dayBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dayBadgeText: { fontSize: 12, fontWeight: FW.semibold },

  chevron:         { fontSize: 22, color: D.SUBTLE, transform: [{ rotate: '90deg' }] },
  chevronExpanded: { transform: [{ rotate: '-90deg' }] },

  // summary row
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
  },
  statCell:       { flex: 1 },
  statCellCenter: { alignItems: 'center' },
  statCellRight:  { alignItems: 'flex-end' },
  statLabel:      { fontSize: FS.xs, color: D.SUBTLE, marginBottom: 2 },
  statValue:      { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT },
  statValueSm:    { fontSize: FS.xs, fontWeight: FW.medium, color: D.TEXT },

  // shifts section
  shiftsSection: {},
  shiftsDivider: { height: 1, backgroundColor: D.BORDER },
  shiftsLoader:  { paddingVertical: SP.lg },
  noShiftsText: {
    fontSize: FS.sm,
    color: D.SUBTLE,
    textAlign: 'center',
    paddingVertical: SP.md,
  },

  // shift row
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
  },
  shiftRowBorder: { borderBottomWidth: 1, borderBottomColor: D.BORDER },

  shiftLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: SP.sm },
  shiftCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: D.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SP.sm,
  },
  shiftCircleText: { fontSize: FS.sm, fontWeight: FW.bold, color: '#fff' },
  shiftInfo:       { flex: 1 },
  shiftName:       { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT, marginBottom: 2 },
  shiftTime:       { fontSize: FS.xs, color: D.SUBTLE },

  shiftRight:     { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  shiftRightInfo: { alignItems: 'flex-end' },
  shiftSales:     { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT, marginBottom: 2 },
  varRow:         { flexDirection: 'row', alignItems: 'center', gap: SP.xs },
  varDot:         { width: 6, height: 6, borderRadius: 3 },
  varLabel:       { fontSize: FS.xs, fontWeight: FW.medium },
  shiftChevron:   { fontSize: 20, color: D.SUBTLE },

  // skeleton
  skelCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    padding: SP.lg,
    ...CARD_SHADOW,
  },
  skelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SP.md,
  },
  skelLeft:    { gap: SP.xs },
  skelDateBar: { width: 130, height: 14, backgroundColor: D.BORDER, borderRadius: 7 },
  skelYearBar: { width: 36,  height: 11, backgroundColor: D.BORDER, borderRadius: 5 },
  skelBadge:   { width: 80,  height: 22, backgroundColor: D.BORDER, borderRadius: BR.full },
  skelSummary: { flexDirection: 'row', gap: SP.md },
  skelStat:    { flex: 1, height: 32, backgroundColor: D.BORDER, borderRadius: BR.sm },
});
