import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';

import { listShifts } from '../api/shifts';
import { listActiveUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shifts, setShifts] = useState([]);

  // Admin filter draft state — dates stored as Date | null
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);

  // Committed filters — ref keeps them accessible inside useFocusEffect
  const appliedFiltersRef = useRef({});
  const [appliedFilters, setAppliedFilters] = useState({});

  const loadShifts = useCallback(async (filters = {}) => {
    try {
      const params = isAdmin ? { limit: 50, ...filters } : {};
      const data = await listShifts(params);
      setShifts(data.shifts || []);
    } catch (err) {
      Alert.alert(t('history.errorLoadingShifts'), err.message || t('common.tryAgain'));
    }
  }, [t, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadShifts(appliedFiltersRef.current).finally(() => setLoading(false));
    }, [loadShifts])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadShifts(appliedFiltersRef.current);
    setRefreshing(false);
  }

  async function handleToggleFilters() {
    const next = !filterExpanded;
    setFilterExpanded(next);
    if (next && !usersLoaded) {
      try {
        const users = await listActiveUsers();
        setActiveUsers(users);
        setUsersLoaded(true);
      } catch (_) {}
    }
  }

  function handleApply() {
    const filters = {};
    if (fromDate) filters.from = fromDate.toISOString().split('T')[0];
    if (toDate) filters.to = toDate.toISOString().split('T')[0];
    if (statusFilter) filters.status = statusFilter;
    if (employeeFilter) filters.opened_by_user_id = employeeFilter.user_id;
    appliedFiltersRef.current = filters;
    setAppliedFilters(filters);
    setFilterExpanded(false);
    setLoading(true);
    loadShifts(filters).finally(() => setLoading(false));
  }

  function handleClear() {
    setFromDate(null);
    setToDate(null);
    setStatusFilter('');
    setEmployeeFilter(null);
    appliedFiltersRef.current = {};
    setAppliedFilters({});
    setLoading(true);
    loadShifts({}).finally(() => setLoading(false));
  }

  const activeFilterCount = Object.keys(appliedFilters).length;

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
        <Text style={styles.title}>{t('history.title')}</Text>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.filterPill, activeFilterCount > 0 && styles.filterPillActive]}
            onPress={handleToggleFilters}
          >
            <Text style={[styles.filterPillText, activeFilterCount > 0 && styles.filterPillTextActive]}>
              {t('history.filters.pill')}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isAdmin && filterExpanded && (
        <FilterPanel
          t={t}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          employeeFilter={employeeFilter}
          setEmployeeFilter={setEmployeeFilter}
          activeUsers={activeUsers}
          showEmployeePicker={showEmployeePicker}
          setShowEmployeePicker={setShowEmployeePicker}
          onApply={handleApply}
          onClear={handleClear}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {shifts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('history.noShifts')}</Text>
            <Text style={styles.emptyHint}>{t('history.noShiftsHint')}</Text>
          </View>
        ) : (
          shifts.map((shift) => (
            <ShiftCard
              key={shift.shift_id}
              shift={shift}
              t={t}
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

// ---------------------------------------------------------------------------
// Filter Panel
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = (t) => [
  { value: '', label: t('history.filters.statusAll') },
  { value: 'open', label: t('history.statusOpen') },
  { value: 'closed', label: t('history.filters.statusClosed') },
  { value: 'voided', label: t('history.statusVoided') },
];

function FilterPanel({
  t,
  fromDate, setFromDate,
  toDate, setToDate,
  statusFilter, setStatusFilter,
  employeeFilter, setEmployeeFilter,
  activeUsers,
  showEmployeePicker, setShowEmployeePicker,
  onApply, onClear,
}) {
  // Which date field is currently open in the picker: 'from' | 'to' | null
  const [activeDateField, setActiveDateField] = useState(null);

  const pickerValue = activeDateField === 'from'
    ? (fromDate || new Date())
    : (toDate || new Date());

  function handleDateChange(event, selectedDate) {
    if (Platform.OS === 'android') {
      setActiveDateField(null);
      if (event.type === 'set' && selectedDate) {
        if (activeDateField === 'from') setFromDate(selectedDate);
        else setToDate(selectedDate);
      }
    } else {
      // iOS fires on every spinner move — just update the value; Done closes the modal
      if (selectedDate) {
        if (activeDateField === 'from') setFromDate(selectedDate);
        else setToDate(selectedDate);
      }
    }
  }

  return (
    <View style={styles.filterPanel}>
      {/* ── Date range ────────────────────────────── */}
      <View style={styles.filterRow}>
        <View style={styles.filterHalf}>
          <Text style={styles.filterLabel}>{t('history.filters.from')}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setActiveDateField('from')}
          >
            <Text style={fromDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
              {fromDate ? fromDate.toISOString().split('T')[0] : t('history.filters.datePlaceholder')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.filterHalf, { marginLeft: 8 }]}>
          <Text style={styles.filterLabel}>{t('history.filters.to')}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setActiveDateField('to')}
          >
            <Text style={toDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
              {toDate ? toDate.toISOString().split('T')[0] : t('history.filters.datePlaceholder')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Status pills ──────────────────────────── */}
      <Text style={[styles.filterLabel, { marginTop: 10 }]}>{t('history.filters.status')}</Text>
      <View style={styles.statusRow}>
        {STATUS_OPTIONS(t).map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.statusPill, statusFilter === opt.value && styles.statusPillActive]}
            onPress={() => setStatusFilter(opt.value)}
          >
            <Text style={[styles.statusPillText, statusFilter === opt.value && styles.statusPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Employee dropdown ─────────────────────── */}
      <Text style={[styles.filterLabel, { marginTop: 10 }]}>{t('history.filters.employee')}</Text>
      <TouchableOpacity
        style={styles.employeeButton}
        onPress={() => setShowEmployeePicker(true)}
      >
        <Text style={styles.employeeButtonText}>
          {employeeFilter ? employeeFilter.username : t('history.filters.allEmployees')}
        </Text>
        <Text style={styles.employeeChevron}>{'▾'}</Text>
      </TouchableOpacity>

      {/* ── Apply / Clear ─────────────────────────── */}
      <View style={styles.filterActions}>
        <TouchableOpacity style={styles.clearButton} onPress={onClear}>
          <Text style={styles.clearButtonText}>{t('history.filters.clear')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={onApply}>
          <Text style={styles.applyButtonText}>{t('history.filters.apply')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Android date picker (native dialog) ─── */}
      {activeDateField !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="calendar"
          onChange={handleDateChange}
        />
      )}

      {/* ── iOS date picker (bottom sheet) ────────── */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={activeDateField !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveDateField(null)}
        >
          <View style={styles.iosPickerOverlay}>
            <View style={styles.iosPickerSheet}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setActiveDateField(null)}>
                  <Text style={styles.iosPickerDone}>{t('common.ok')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* ── Employee picker modal ─────────────────── */}
      <Modal
        visible={showEmployeePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmployeePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEmployeePicker(false)}
        >
          <View style={styles.pickerModal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[styles.pickerItem, !employeeFilter && styles.pickerItemSelected]}
                onPress={() => { setEmployeeFilter(null); setShowEmployeePicker(false); }}
              >
                <Text style={[styles.pickerItemText, !employeeFilter && styles.pickerItemTextSelected]}>
                  {t('history.filters.allEmployees')}
                </Text>
              </TouchableOpacity>
              {activeUsers.map((u) => (
                <TouchableOpacity
                  key={u.user_id}
                  style={[styles.pickerItem, employeeFilter?.user_id === u.user_id && styles.pickerItemSelected]}
                  onPress={() => { setEmployeeFilter(u); setShowEmployeePicker(false); }}
                >
                  <Text style={[styles.pickerItemText, employeeFilter?.user_id === u.user_id && styles.pickerItemTextSelected]}>
                    {u.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shift card
// ---------------------------------------------------------------------------

function ShiftCard({ shift, t, onPress }) {
  const isOpen = shift.is_shift_open;
  const isVoided = shift.voided;
  const status = shift.shift_status;

  let badgeColor = '#888';
  let badgeBg = '#f0f0f0';
  let badgeText = '—';

  if (isVoided) {
    badgeText = t('history.statusVoided');
    badgeColor = '#7c2d12';
    badgeBg = '#fee2e2';
  } else if (isOpen) {
    badgeText = t('history.statusOpen');
    badgeColor = '#1a73e8';
    badgeBg = '#e8f0fe';
  } else if (status === 'correct') {
    badgeText = t('history.statusCorrect');
    badgeColor = '#166534';
    badgeBg = '#dcfce7';
  } else if (status === 'over') {
    badgeText = t('history.statusOver');
    badgeColor = '#b45309';
    badgeBg = '#fef3c7';
  } else if (status === 'short') {
    badgeText = t('history.statusShort');
    badgeColor = '#dc2626';
    badgeBg = '#fef2f2';
  }

  const tickets = parseFloat(shift.tickets_total || '0');
  const diff = parseFloat(shift.difference || '0');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(shift.shift_start_time)}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <KV k={t('history.ticketsTotal')} v={`$${tickets.toFixed(2)}`} />
        <KV k={t('history.difference')} v={`$${diff.toFixed(2)}`} vColor={diffColor(diff, status)} />
        <KV k={t('history.subshifts')} v={shift.subshift_count ?? '—'} />
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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

  // ── Filter pill ──────────────────────────────
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  filterPillActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  filterPillText: { fontSize: 13, color: '#555', fontWeight: '600' },
  filterPillTextActive: { color: '#1a73e8' },

  // ── Filter panel ─────────────────────────────
  filterPanel: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  filterRow: { flexDirection: 'row' },
  filterHalf: { flex: 1 },
  filterLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 4 },

  // Date picker button
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  dateButtonText: { fontSize: 13, color: '#333' },
  dateButtonPlaceholder: { fontSize: 13, color: '#bbb' },

  // Status pills
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  statusPillActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  statusPillText: { fontSize: 12, color: '#666' },
  statusPillTextActive: { color: '#1a73e8', fontWeight: '700' },

  // Employee dropdown
  employeeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 2,
  },
  employeeButtonText: { fontSize: 13, color: '#333' },
  employeeChevron: { fontSize: 13, color: '#888' },

  // Apply / Clear
  filterActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  clearButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  clearButtonText: { fontSize: 14, color: '#555', fontWeight: '600' },
  applyButton: {
    flex: 2,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  applyButtonText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // iOS date picker bottom sheet
  iosPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iosPickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  iosPickerDone: { fontSize: 16, color: '#1a73e8', fontWeight: '600' },

  // Employee picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxHeight: 320,
    paddingVertical: 6,
  },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 13 },
  pickerItemSelected: { backgroundColor: '#e8f0fe' },
  pickerItemText: { fontSize: 15, color: '#333' },
  pickerItemTextSelected: { color: '#1a73e8', fontWeight: '700' },

  // Shift card
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
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
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
