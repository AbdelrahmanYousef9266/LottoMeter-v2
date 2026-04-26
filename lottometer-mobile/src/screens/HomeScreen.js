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

import { useAuth } from '../context/AuthContext';
import {
  openShift,
  listShifts,
  getShift,
} from '../api/shifts';

export default function HomeScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shiftDetail, setShiftDetail] = useState(null); // full shift object or null

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
      Alert.alert('Error loading shift', err.message || 'Network error');
      setShiftDetail(null);
    }
  }, []);

  // Refresh when screen comes into focus
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
      Alert.alert('Could not open shift', err.message || 'Try again.');
    } finally {
      setBusy(false);
    }
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.greeting}>Hi, {user?.username}</Text>

        {!shiftDetail ? (
          <NoShiftView onOpen={handleOpenShift} busy={busy} />
        ) : (
          <ActiveShiftView shiftDetail={shiftDetail} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoShiftView({ onOpen, busy }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>No active shift</Text>
      <Text style={styles.cardSubtitle}>
        Open a shift to start scanning and tracking sales.
      </Text>
      <TouchableOpacity
        style={[styles.primaryButton, busy && styles.disabled]}
        onPress={onOpen}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Open Shift</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ActiveShiftView({ shiftDetail }) {
  const main = shiftDetail.main_shift;
  const subs = shiftDetail.subshifts || [];
  const currentPending = shiftDetail.current_subshift_pending;
  const currentSub = subs.find((s) => s.is_shift_open);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.shiftHeader}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>● Active</Text>
          </View>
          <Text style={styles.shiftId}>Shift #{main.shift_id}</Text>
        </View>
        <Text style={styles.cardTitle}>Main Shift</Text>
        <KV k="Started by" v={main.opened_by?.username} />
        <KV k="Started" v={formatTime(main.shift_start_time)} />
        <KV k="Sub-shifts" v={subs.length} />
      </View>

      {currentSub && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Sub-shift {currentSub.shift_number}
          </Text>
          <KV k="Opened by" v={currentSub.opened_by?.username} />
          <KV k="Started" v={formatTime(currentSub.shift_start_time)} />
          {currentPending && (
            <KV
              k="Pending scans"
              v={currentPending.pending_scans?.length || 0}
            />
          )}
          {currentPending && !currentPending.is_initialized && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                ⚠ Scan all pending books to initialize this sub-shift
              </Text>
            </View>
          )}
        </View>
      )}
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
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 16,
  },
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
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
  activeBadgeText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  shiftId: {
    marginLeft: 'auto',
    color: '#888',
    fontSize: 14,
  },
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
});