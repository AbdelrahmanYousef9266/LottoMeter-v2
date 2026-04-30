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
import EmptyState from '../components/EmptyState';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDayLabel(dateStr, t) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  const formatted = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (dateStr === getTodayStr()) return `${t('history.today')} — ${formatted}`;
  if (dateStr === getYesterdayStr()) return `${t('history.yesterday')} — ${formatted}`;
  return formatted;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmt$(v) {
  if (v === null || v === undefined) return '$0.00';
  const n = parseFloat(v);
  return Number.isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessDays, setBusinessDays] = useState([]);
  const [expandedDayId, setExpandedDayId] = useState(null);

  // shiftsCache: { [dayId]: { shifts: [], loading: bool } }
  // Stored in a ref so mutations don't trigger unnecessary renders.
  const shiftsCacheRef = useRef({});
  // Bumped after every cache mutation to tell FlatList to re-render.
  const [cacheVersion, setCacheVersion] = useState(0);

  const loadDays = useCallback(async () => {
    try {
      const data = await listBusinessDays();
      const days = (data.business_days || []).sort((a, b) =>
        b.business_date.localeCompare(a.business_date)
      );
      setBusinessDays(days);
    } catch (err) {
      Alert.alert(t('history.errorLoadingDays'), err.message || t('common.tryAgain'));
    }
  }, [t]);

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

    if (shiftsCacheRef.current[day.id]) return; // already cached

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
        keyExtractor={(d) => String(d.id)}
        renderItem={renderDay}
        extraData={[expandedDayId, cacheVersion]}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
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

  return (
    <View
      style={[
        styles.dayCard,
        isOpen ? styles.dayCardOpen : styles.dayCardClosed,
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayDate}>
              {formatDayLabel(day.business_date, t)}
            </Text>
            <Text style={styles.daySales}>{fmt$(day.total_sales)}</Text>
          </View>
          <View style={styles.dayRight}>
            <View
              style={[
                styles.dayBadge,
                isOpen ? styles.badgeOpen : styles.badgeClosed,
              ]}
            >
              <Text
                style={[
                  styles.dayBadgeText,
                  isOpen ? styles.badgeOpenText : styles.badgeClosedText,
                ]}
              >
                {t(isOpen ? 'history.statusOpen' : 'history.statusClosed')}
              </Text>
            </View>
            <Text
              style={[styles.chevron, isExpanded && styles.chevronExpanded]}
            >
              {'▼'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.shiftsContainer}>
          <View style={styles.shiftsDivider} />
          {shiftsLoading ? (
            <ActivityIndicator
              size="small"
              color="#1a73e8"
              style={styles.shiftsLoader}
            />
          ) : shifts.length === 0 ? (
            <Text style={styles.noShiftsText}>{t('history.noShifts')}</Text>
          ) : (
            shifts.map((shift) => (
              <ShiftRow
                key={shift.id}
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
    badgeBg = '#fee2e2';
    badgeColor = '#7c2d12';
  } else if (isOpen) {
    badgeText = t('history.statusActive');
    badgeBg = '#e8f0fe';
    badgeColor = '#1a73e8';
  } else if (shift.shift_status === 'correct') {
    badgeText = t('history.statusCorrect');
    badgeBg = '#dcfce7';
    badgeColor = '#166534';
  } else if (shift.shift_status === 'over') {
    badgeText = t('history.statusOver');
    badgeBg = '#fef3c7';
    badgeColor = '#b45309';
  } else if (shift.shift_status === 'short') {
    badgeText = t('history.statusShort');
    badgeBg = '#fef2f2';
    badgeColor = '#dc2626';
  } else {
    badgeText = '—';
    badgeBg = '#f0f0f0';
    badgeColor = '#888';
  }

  const openedBy =
    shift.employee_id === user?.user_id
      ? user?.username
      : `#${shift.employee_id}`;

  const endLabel = isOpen
    ? t('history.statusActive')
    : formatTime(shift.closed_at);

  return (
    <TouchableOpacity
      style={styles.shiftRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.shiftLeft}>
        <Text style={styles.shiftNumber}>
          {t('history.shiftNumber', { number: shift.shift_number })}
        </Text>
        <Text style={styles.shiftTime}>
          {`${formatTime(shift.opened_at)} → ${endLabel}`}
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
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 650,
          useNativeDriver: true,
        }),
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
  container: { flex: 1, backgroundColor: '#f4f5f7' },

  titleRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#222' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // ── day card ────────────────────────────────────────────────────────────
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden',
  },
  dayCardOpen: { borderLeftColor: '#16a34a' },
  dayCardClosed: { borderLeftColor: '#ccc' },

  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  dayInfo: { flex: 1, marginRight: 8 },
  dayDate: { fontSize: 14, fontWeight: '600', color: '#222', marginBottom: 3 },
  daySales: { fontSize: 13, color: '#666' },

  dayRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  dayBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeOpen: { backgroundColor: '#dcfce7' },
  badgeClosed: { backgroundColor: '#f0f0f0' },
  dayBadgeText: { fontSize: 12, fontWeight: '700' },
  badgeOpenText: { color: '#166534' },
  badgeClosedText: { color: '#666' },

  chevron: {
    fontSize: 12,
    color: '#aaa',
    marginLeft: 2,
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },

  // ── expanded shifts section ──────────────────────────────────────────────
  shiftsContainer: { paddingBottom: 6 },
  shiftsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eee',
    marginHorizontal: 16,
    marginBottom: 4,
  },
  shiftsLoader: { paddingVertical: 14 },
  noShiftsText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // ── shift row ────────────────────────────────────────────────────────────
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f2f2f2',
  },
  shiftLeft: { flex: 1, marginRight: 10 },
  shiftNumber: { fontSize: 14, fontWeight: '700', color: '#222', marginBottom: 2 },
  shiftTime: { fontSize: 12, color: '#555', marginBottom: 2 },
  shiftOpenedBy: { fontSize: 11, color: '#999' },

  shiftBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
  },
  shiftBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── skeleton ─────────────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
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
    backgroundColor: '#e8e8e8',
    flex: 0.65,
  },
  skeletonBadge: {
    height: 22,
    width: 54,
    borderRadius: 999,
    backgroundColor: '#e8e8e8',
  },
  skeletonLineShort: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#efefef',
    width: '35%',
  },
});
