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

import { getShiftReport } from '../api/reports';

export default function ReportDetailScreen({ route }) {
  const { shiftId } = route.params;
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState(null);

  const loadReport = useCallback(async () => {
    try {
      const data = await getShiftReport(shiftId);
      setReport(data);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load report.');
    }
  }, [shiftId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadReport().finally(() => setLoading(false));
    }, [loadReport])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadReport();
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

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Report not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const main = report.main_shift;
  const totals = main.totals || {};
  const subshifts = report.subshifts || [];
  const voidedSubshifts = report.voided_subshifts || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Main Shift Summary */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Main Shift #{main.shift_id}</Text>
            <StatusBadge status={totals.shift_status} voided={main.voided} />
          </View>
          <KV k="Started" v={formatTime(main.shift_start_time)} />
          <KV k="Ended" v={formatTime(main.shift_end_time)} />
          <KV k="Opened by" v={main.opened_by?.username} />
        </View>

        {/* Totals */}
        <SectionTitle text="Totals" />
        <View style={styles.card}>
          <KV k="Tickets Total" v={fmt$(totals.tickets_total)} />
          <KV k="Gross Sales" v={fmt$(totals.gross_sales)} />
          <KV k="Cash in Hand" v={fmt$(totals.cash_in_hand)} />
          <KV k="Expected Cash" v={fmt$(totals.expected_cash)} />
          <KV
            k="Difference"
            v={fmt$(totals.difference)}
            vColor={diffColor(totals.shift_status)}
          />
        </View>

        {/* Ticket Breakdown */}
        {main.ticket_breakdown?.length > 0 && (
          <>
            <SectionTitle text="Ticket Breakdown" />
            <View style={styles.card}>
              {main.ticket_breakdown.map((row, i) => (
                <View key={i} style={styles.kvRow}>
                  <Text style={styles.kvKey}>
                    ${row.ticket_price} · {row.source}
                  </Text>
                  <Text style={styles.kvValue}>
                    {row.tickets_sold} → {fmt$(row.subtotal)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Sub-shifts */}
        {subshifts.length > 0 && (
          <>
            <SectionTitle text="Sub-shifts" />
            {subshifts.map((sub) => (
              <SubshiftCard key={sub.shift_id} sub={sub} />
            ))}
          </>
        )}

        {/* Voided sub-shifts */}
        {voidedSubshifts.length > 0 && (
          <>
            <SectionTitle text="Voided Sub-shifts" />
            {voidedSubshifts.map((sub) => (
              <View key={sub.shift_id} style={[styles.card, styles.voidedCard]}>
                <View style={styles.headerRow}>
                  <Text style={styles.subTitle}>
                    Sub-shift {sub.shift_number}
                  </Text>
                  <View style={styles.voidedBadge}>
                    <Text style={styles.voidedText}>VOIDED</Text>
                  </View>
                </View>
                <KV k="Reason" v={sub.void_reason || '—'} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SubshiftCard({ sub }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.subTitle}>Sub-shift {sub.shift_number}</Text>
        <StatusBadge status={sub.shift_status} voided={sub.voided} />
      </View>

      <KV k="Opened by" v={sub.opened_by?.username} />
      <KV k="Closed by" v={sub.closed_by?.username} />
      <KV k="Started" v={formatTime(sub.shift_start_time)} />
      <KV k="Ended" v={formatTime(sub.shift_end_time)} />

      <View style={styles.divider} />

      <KV k="Cash in Hand" v={fmt$(sub.cash_in_hand)} />
      <KV k="Gross Sales" v={fmt$(sub.gross_sales)} />
      <KV k="Cash Out" v={fmt$(sub.cash_out)} />
      <KV k="Tickets Total" v={fmt$(sub.tickets_total)} />
      <KV k="Expected Cash" v={fmt$(sub.expected_cash)} />
      <KV
        k="Difference"
        v={fmt$(sub.difference)}
        vColor={diffColor(sub.shift_status)}
      />

      {/* Books */}
      {sub.books?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Books</Text>
          {sub.books.map((b, i) => (
            <View key={i} style={styles.bookRow}>
              <View style={styles.bookHeader}>
                <Text style={styles.bookCode}>{b.static_code}</Text>
                <Text style={styles.bookValue}>{fmt$(b.value)}</Text>
              </View>
              <Text style={styles.bookMeta}>
                {b.slot_name} · ${b.ticket_price} · {b.open_position} → {b.close_position} · {b.tickets_sold} sold
                {b.fully_sold && ' · ✓ sold out'}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Whole-book sales */}
      {sub.whole_book_sales?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Whole-Book Sales</Text>
          {sub.whole_book_sales.map((s) => (
            <View key={s.extra_sale_id} style={styles.bookRow}>
              <View style={styles.bookHeader}>
                <Text style={styles.bookCode}>{s.scanned_barcode}</Text>
                <Text style={styles.bookValue}>{fmt$(s.value)}</Text>
              </View>
              <Text style={styles.bookMeta}>
                ${s.ticket_price} · {s.ticket_count} tickets · {s.created_by?.username}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Returned books */}
      {sub.returned_books?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Returned Books</Text>
          {sub.returned_books.map((r) => (
            <View key={r.book_id} style={styles.bookRow}>
              <View style={styles.bookHeader}>
                <Text style={styles.bookCode}>{r.static_code}</Text>
                <Text style={styles.bookValue}>{fmt$(r.value)}</Text>
              </View>
              <Text style={styles.bookMeta}>
                {r.slot_name} · ${r.ticket_price} · {r.open_position} → {r.returned_at_position} · {r.tickets_sold} sold before return
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Ticket breakdown for sub-shift */}
      {sub.ticket_breakdown?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Ticket Breakdown</Text>
          {sub.ticket_breakdown.map((row, i) => (
            <View key={i} style={styles.kvRow}>
              <Text style={styles.kvKey}>
                ${row.ticket_price} · {row.source}
              </Text>
              <Text style={styles.kvValue}>
                {row.tickets_sold} → {fmt$(row.subtotal)}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function StatusBadge({ status, voided }) {
  let color = '#888';
  let bg = '#f0f0f0';
  let text = '—';

  if (voided) {
    text = 'Voided';
    color = '#7c2d12';
    bg = '#fee2e2';
  } else if (status === 'correct') {
    text = 'Correct';
    color = '#166534';
    bg = '#dcfce7';
  } else if (status === 'over') {
    text = 'Over';
    color = '#b45309';
    bg = '#fef3c7';
  } else if (status === 'short') {
    text = 'Short';
    color = '#dc2626';
    bg = '#fef2f2';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function SectionTitle({ text }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function KV({ k, v, vColor }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvValue, vColor && { color: vColor }]}>{v ?? '—'}</Text>
    </View>
  );
}

function fmt$(v) {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (Number.isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function diffColor(status) {
  if (status === 'correct') return '#16a34a';
  if (status === 'over') return '#b45309';
  if (status === 'short') return '#dc2626';
  return '#222';
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { padding: 16 },
  backText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },

  scroll: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  voidedCard: { opacity: 0.7 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#222' },
  subTitle: { fontSize: 16, fontWeight: '700', color: '#222' },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginTop: 12,
    marginBottom: 6,
    marginHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  voidedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  voidedText: { fontSize: 12, fontWeight: '700', color: '#7c2d12' },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvKey: { color: '#666', fontSize: 13 },
  kvValue: { color: '#222', fontSize: 13, fontWeight: '600' },

  bookRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  bookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bookCode: { fontSize: 14, fontWeight: '600', color: '#222' },
  bookValue: { fontSize: 14, fontWeight: '600', color: '#222' },
  bookMeta: { fontSize: 12, color: '#666', marginTop: 2 },
});