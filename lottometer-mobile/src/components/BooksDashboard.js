import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { getBooksSummary, getBooksActivity } from '../api/books';

const PERIODS = ['week', 'month', 'year', 'all'];

export default function BooksDashboard() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  // Section 1 — current state
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Section 2 — activity over time
  const [period, setPeriod] = useState('week');
  const [activity, setActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getBooksSummary();
      setSummary(data);
    } catch (err) {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async (p) => {
    setActivityLoading(true);
    try {
      const data = await getBooksActivity(p);
      setActivity(data);
    } catch (err) {
      setActivity(null);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSummaryLoading(true);
      loadSummary();
      loadActivity(period);
    }, [loadSummary, loadActivity, period])
  );

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    loadActivity(newPeriod);
  };

  const goToList = (status) => {
    navigation.navigate('BooksList', { initialStatus: status });
  };

  return (
    <View style={styles.card}>
      {/* Section 1 — Books Dashboard */}
      <Text style={styles.sectionTitle}>{t('booksDashboard.title')}</Text>

      {summaryLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#1a73e8" />
        </View>
      ) : !summary ? (
        <Text style={styles.errorText}>{t('booksDashboard.errorTapRetry')}</Text>
      ) : (
        <>
          <View style={styles.chipsRow}>
            <CurrentChip
              label={t('booksDashboard.active')}
              count={summary.active}
              color="#1a73e8"
              onPress={() => goToList('active')}
            />
            <CurrentChip
              label={t('booksDashboard.sold')}
              count={summary.sold}
              color="#137333"
              onPress={() => goToList('sold')}
            />
            <CurrentChip
              label={t('booksDashboard.returned')}
              count={summary.returned}
              color="#a8071a"
              onPress={() => goToList('returned')}
            />
          </View>

          <TouchableOpacity onPress={() => goToList('all')} style={styles.allLink}>
            <Text style={styles.allLinkText}>
              {t('booksDashboard.viewAll', { total: summary.total })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#1a73e8" />
          </TouchableOpacity>
        </>
      )}

      {/* Section 2 — Activity */}
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>{t('booksDashboard.activity')}</Text>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodPill, period === p && styles.periodPillActive]}
            onPress={() => handlePeriodChange(p)}
          >
            <Text
              style={[
                styles.periodPillText,
                period === p && styles.periodPillTextActive,
              ]}
            >
              {t(`booksDashboard.period.${p}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activityLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#1a73e8" />
        </View>
      ) : !activity ? (
        <Text style={styles.errorText}>{t('booksDashboard.errorTapRetry')}</Text>
      ) : (
        <View style={styles.chipsRow}>
          <ActivityChip
            label={t('booksDashboard.sold')}
            current={activity.sold}
            previous={activity.previous_period?.sold}
            color="#137333"
          />
          <ActivityChip
            label={t('booksDashboard.returned')}
            current={activity.returned}
            previous={activity.previous_period?.returned}
            color="#a8071a"
          />
        </View>
      )}
    </View>
  );
}

function CurrentChip({ label, count, color, onPress }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress}>
      <Text style={[styles.chipCount, { color }]}>{count}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActivityChip({ label, current, previous, color }) {
  let trend = null;
  if (previous !== null && previous !== undefined) {
    if (current > previous) {
      trend = { icon: 'arrow-up', color: '#137333', text: `+${current - previous}` };
    } else if (current < previous) {
      trend = { icon: 'arrow-down', color: '#a8071a', text: `-${previous - current}` };
    } else if (current === previous && current > 0) {
      trend = { icon: 'remove', color: '#5f6368', text: '0' };
    }
  }

  return (
    <View style={styles.chip}>
      <Text style={[styles.chipCount, { color }]}>{current}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
      {trend && (
        <View style={[styles.trendBadge, { backgroundColor: trend.color + '20' }]}>
          <Ionicons name={trend.icon} size={10} color={trend.color} />
          <Text style={[styles.trendText, { color: trend.color }]}>{trend.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5f6368',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  loadingWrap: { alignItems: 'center', paddingVertical: 16 },
  errorText: {
    color: '#5f6368',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },

  chipsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    marginHorizontal: -4,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  chipCount: { fontSize: 28, fontWeight: '700' },
  chipLabel: { fontSize: 12, color: '#5f6368', marginTop: 2 },

  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    gap: 2,
  },
  trendText: { fontSize: 10, fontWeight: '600' },

  allLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  allLinkText: {
    color: '#1a73e8',
    fontSize: 14,
    fontWeight: '500',
    marginEnd: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#f1f3f4',
    marginVertical: 16,
  },

  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
  },
  periodPillActive: { backgroundColor: '#1a73e8' },
  periodPillText: { fontSize: 12, color: '#5f6368', fontWeight: '500' },
  periodPillTextActive: { color: '#fff' },
});
