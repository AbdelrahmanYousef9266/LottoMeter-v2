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
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { listShifts } from '../api/shifts';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shifts, setShifts] = useState([]);

  const loadShifts = useCallback(async () => {
    try {
      const data = await listShifts({ limit: 50 });
      setShifts(data.shifts || []);
    } catch (err) {
      Alert.alert('Error loading shifts', err.message || 'Try again.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadShifts().finally(() => setLoading(false));
    }, [loadShifts])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadShifts();
    setRefreshing(false);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {shifts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No shifts yet.</Text>
            <Text style={styles.emptyHint}>
              Closed shifts will appear here.
            </Text>
          </View>
        ) : (
          shifts.map((shift) => (
            <ShiftCard
              key={shift.shift_id}
              shift={shift}
              onPress={() =>
                navigation.navigate('ReportDetail', { shiftId: shift.shift_id })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShiftCard({ shift, onPress }) {
  const isOpen = shift.is_shift_open;
  const isVoided = shift.voided;
  const status = shift.shift_status; // correct | over | short | null

  let badgeColor = '#888';
  let badgeBg = '#f0f0f0';
  let badgeText = isOpen ? 'Open' : '—';

  if (isVoided) {
    badgeText = 'Voided';
    badgeColor = '#7c2d12';
    badgeBg = '#fee2e2';
  } else if (isOpen) {
    badgeText = 'Open';
    badgeColor = '#1a73e8';
    badgeBg = '#e8f0fe';
  } else if (status === 'correct') {
    badgeText = 'Correct';
    badgeColor = '#166534';
    badgeBg = '#dcfce7';
  } else if (status === 'over') {
    badgeText = 'Over';
    badgeColor = '#b45309';
    badgeBg = '#fef3c7';
  } else if (status === 'short') {
    badgeText = 'Short';
    badgeColor = '#dc2626';
    badgeBg = '#fef2f2';
  }

  const tickets = parseFloat(shift.tickets_total || '0');
  const diff = parseFloat(shift.difference || '0');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>
          {formatDate(shift.shift_start_time)}
        </Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <KV k="Tickets Total" v={`$${tickets.toFixed(2)}`} />
        <KV k="Difference" v={`$${diff.toFixed(2)}`} vColor={diffColor(diff, status)} />
        <KV k="Sub-shifts" v={shift.subshift_count ?? '—'} />
      </View>
    </TouchableOpacity>
  );
}

function diffColor(diff, status) {
  if (status === 'correct' || Math.abs(diff) < 0.005) return '#16a34a';
  if (status === 'over' || diff > 0) return '#b45309';
  if (status === 'short' || diff < 0) return '#dc2626';
  return '#222';
}

function KV({ k, v, vColor }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvValue, vColor && { color: vColor }]}>{v ?? '—'}</Text>
    </View>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 32 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 4 },
  emptyHint: { fontSize: 13, color: '#888' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardDate: { fontSize: 14, fontWeight: '600', color: '#333' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  cardBody: {},
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvKey: { color: '#666', fontSize: 13 },
  kvValue: { color: '#222', fontSize: 13, fontWeight: '600' },
});