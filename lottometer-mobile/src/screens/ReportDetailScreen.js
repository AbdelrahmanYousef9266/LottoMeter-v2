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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getShiftReport } from '../api/reports';
import { formatLocalDateTime, formatLocalTime, formatBusinessDate } from '../utils/dateTime';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../offline/db';

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

// ── display helpers ────────────────────────────────────────────────────────────

function fmt$(v) {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (Number.isNaN(n)) return '—';
  return `$${n.toFixed(2)}`;
}

function diffColor(status) {
  if (status === 'correct') return D.SUCCESS;
  if (status === 'over')    return D.WARNING;
  if (status === 'short')   return D.ERROR;
  return D.TEXT;
}

function getTopBarColor(shift) {
  if (shift.shift_status === 'correct') return D.SUCCESS;
  if (shift.shift_status === 'short')   return D.ERROR;
  if (shift.shift_status === 'over')    return D.WARNING;
  return D.PRIMARY;
}

function getDiffBg(status) {
  if (status === 'correct') return '#F0FDF4';
  if (status === 'short')   return '#FEF2F2';
  if (status === 'over')    return '#FFFBEB';
  return D.BACKGROUND;
}

function formatDiffAmount(difference, status) {
  const n = parseFloat(difference ?? 0);
  if (Number.isNaN(n)) return '—';
  const abs = `$${Math.abs(n).toFixed(2)}`;
  if (status === 'over')  return `+${abs}`;
  if (status === 'short') return `-${abs}`;
  return abs;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shiftDuration(openedAt, closedAt) {
  if (!openedAt) return '—';
  const end = closedAt ? new Date(closedAt) : new Date();
  const ms  = end - new Date(openedAt);
  const h   = Math.floor(ms / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// ── screen ─────────────────────────────────────────────────────────────────────

export default function ReportDetailScreen({ route }) {
  const { t, i18n } = useTranslation();
  const { shiftId } = route.params;
  const navigation = useNavigation();
  const { isOffline, store } = useAuth();

  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting]   = useState(false);
  const [report, setReport]       = useState(null);

  const loadReport = useCallback(async () => {
    try {
      if (isOffline) {
        const db = await getDb();

        const localShift = await db.getFirstAsync(
          `SELECT * FROM local_employee_shifts
           WHERE (server_id = ? OR id = ?) AND store_id = ?`,
          [shiftId, shiftId, store?.store_id]
        );

        if (!localShift) return; // report stays null → renders "not found"

        const localDay = await db.getFirstAsync(
          'SELECT * FROM local_business_days WHERE uuid = ?',
          [localShift.business_day_uuid]
        );

        // JOIN local_slots to get slot_name for the books section
        const scans = await db.getAllAsync(
          `SELECT lsb.*, lb.ticket_price, lb.slot_id, ls.slot_name
           FROM local_shift_books lsb
           JOIN local_books lb ON lb.static_code = lsb.static_code
           LEFT JOIN local_slots ls ON ls.server_id = lb.slot_id
           WHERE lsb.shift_uuid = ?
           ORDER BY lsb.scanned_at ASC`,
          [localShift.uuid]
        );

        const extraSales = await db.getAllAsync(
          'SELECT * FROM local_extra_sales WHERE shift_uuid = ?',
          [localShift.uuid]
        );

        const openScans  = scans.filter(s => s.scan_type === 'open');
        const closeScans = scans.filter(s => s.scan_type === 'close');

        const books = openScans.map(openScan => {
          const closeScan = closeScans.find(c => c.static_code === openScan.static_code);
          const ticketsSold = closeScan
            ? (closeScan.is_last_ticket
                ? closeScan.start_at_scan - openScan.start_at_scan + 1
                : closeScan.start_at_scan - openScan.start_at_scan)
            : 0;
          return {
            static_code:    openScan.static_code,
            slot_name:      openScan.slot_name || `#${openScan.slot_id}`,
            ticket_price:   openScan.ticket_price,
            open_position:  openScan.start_at_scan,
            close_position: closeScan?.start_at_scan,
            tickets_sold:   ticketsSold,
            value:          (ticketsSold * parseFloat(openScan.ticket_price)).toFixed(2),
            fully_sold:     !!closeScan?.is_last_ticket,
          };
        });

        setReport({
          shift: {
            id: localShift.server_id || localShift.id,
            uuid: localShift.uuid,
            shift_number:  localShift.shift_number,
            status:        localShift.status,
            opened_at:     localShift.opened_at,
            closed_at:     localShift.closed_at,
            cash_in_hand:  localShift.cash_in_hand,
            gross_sales:   localShift.gross_sales,
            cash_out:      localShift.cash_out,
            cancels:       localShift.cancels,
            tickets_total: localShift.tickets_total,
            expected_cash: localShift.expected_cash,
            difference:    localShift.difference,
            shift_status:  localShift.shift_status,
            employee_id:   localShift.employee_id,
            books,
            whole_book_sales: extraSales.map(s => ({
              scanned_barcode: s.scanned_barcode,
              ticket_price:    s.ticket_price,
              ticket_count:    s.ticket_count,
              value:           s.value,
            })),
            returned_books:   [],
            ticket_breakdown: [],
          },
          business_day: localDay ? {
            id:            localDay.server_id,
            uuid:          localDay.uuid,
            business_date: localDay.business_date,
            status:        localDay.status,
          } : null,
          offline: true,
        });
        return;
      }

      const data = await getShiftReport(shiftId);
      setReport(data);
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('report.errorLoadingReport'));
    }
  }, [shiftId, t, isOffline, store]);

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

  async function handleRetry() {
    setLoading(true);
    await loadReport();
    setLoading(false);
  }

  async function handlePrint() {
    if (printing || !report) return;
    setPrinting(true);
    try {
      const isRTL = i18n.language === 'ar';
      const html = buildReportHtml(report, t, isRTL);
      await Print.printAsync({ html });
    } catch (err) {
      // Silently ignore user-initiated cancellation
      const msg = err?.message?.toLowerCase() ?? '';
      if (!msg.includes('cancel') && !msg.includes('dismiss')) {
        Alert.alert(t('report.export.printErrorTitle'), err.message || t('common.tryAgain'));
      }
    } finally {
      setPrinting(false);
    }
  }

  async function handleExport() {
    if (exporting || !report) return;
    setExporting(true);
    try {
      const isRTL = i18n.language === 'ar';
      const html = buildReportHtml(report, t, isRTL);

      const dateStr = report.shift.opened_at
        ? new Date(report.shift.opened_at).toISOString().split('T')[0]
        : `shift-${report.shift.shift_id}`;
      const filename = `LottoMeter_${dateStr}.pdf`;

      // Generate PDF to a temp path
      const { uri: tmpUri } = await Print.printToFileAsync({ html, base64: false });

      if (Platform.OS === 'android') {
        // Show Android folder picker — user selects Downloads (or any folder)
        const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perms.granted) {
          await FileSystem.deleteAsync(tmpUri, { idempotent: true });
          return;
        }
        // Read as base64 and write into the chosen folder
        const base64 = await FileSystem.readAsStringAsync(tmpUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perms.directoryUri,
          filename,
          'application/pdf'
        );
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.deleteAsync(tmpUri, { idempotent: true });
        Alert.alert(
          t('report.export.savedTitle'),
          t('report.export.savedMessage', { filename })
        );
      } else {
        // iOS: move to doc dir then open share sheet → user taps "Save to Files"
        const destUri = FileSystem.documentDirectory + filename;
        await FileSystem.moveAsync({ from: tmpUri, to: destUri });
        await Sharing.shareAsync(destUri, {
          mimeType:    'application/pdf',
          dialogTitle: t('report.export.shareTitle'),
          UTI:         'com.adobe.pdf',
        });
      }
    } catch (err) {
      Alert.alert(t('report.export.errorTitle'), err.message || t('common.tryAgain'));
    } finally {
      setExporting(false);
    }
  }

  // ── loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backArrow}>←</Text>
            <Text style={s.backLabel}>Shift Report</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={D.PRIMARY} />
          <Text style={s.loadingText}>Loading report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── error / not found ───────────────────────────────────────────────────────

  if (!report || !report.shift) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backArrow}>←</Text>
            <Text style={s.backLabel}>Shift Report</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={s.errorEmoji}>⚠️</Text>
          <Text style={s.errorText}>{t('report.reportNotFound')}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={handleRetry}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── main render ─────────────────────────────────────────────────────────────

  const shift       = report.shift;
  const businessDay = report.business_day;
  const empName     = shift.opened_by?.username || (shift.employee_id ? `Employee #${shift.employee_id}` : '—');
  const topBarColor = getTopBarColor(shift);
  const diffBg      = getDiffBg(shift.shift_status);
  const diffClr     = diffColor(shift.shift_status);
  const diffAmt     = formatDiffAmount(shift.difference, shift.shift_status);

  return (
    <SafeAreaView style={s.safeArea}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>←</Text>
          <Text style={s.backLabel}>Shift Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.shareBtn, exporting && s.dimmed]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color={D.PRIMARY} />
            : <Text style={s.shareBtnText}>↑</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={D.PRIMARY}
            colors={[D.PRIMARY]}
          />
        }
      >

        {/* ── Shift Summary Card ──────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <View style={[s.summaryBar, { backgroundColor: topBarColor }]} />

          {/* Card header */}
          <View style={s.summaryHeader}>
            <View style={s.summaryLeft}>
              <Text style={s.summaryShiftNum}>
                {t('report.subshiftTitle', { number: shift.shift_number })}
              </Text>
              {businessDay && (
                <Text style={s.summaryDate}>
                  {formatBusinessDate(businessDay.business_date)}
                </Text>
              )}
              {shift.opened_at && (
                <Text style={s.summaryTime}>
                  {formatLocalTime(shift.opened_at)}
                  {' — '}
                  {shift.closed_at ? formatLocalTime(shift.closed_at) : 'Active'}
                </Text>
              )}
            </View>
            <StatusBadge shift={shift} t={t} />
          </View>

          <View style={s.cardDivider} />

          {/* Financials 2×3 grid */}
          <View style={s.financialGrid}>
            <View style={s.gridRow}>
              <FinStat label={t('report.ticketsTotal')} value={fmt$(shift.tickets_total)} />
              <View style={s.gridDividerV} />
              <FinStat label={t('report.grossSales')} value={fmt$(shift.gross_sales)} />
            </View>
            <View style={s.gridDividerH} />
            <View style={s.gridRow}>
              <FinStat label="Cash Out" value={fmt$(shift.cash_out)} />
              <View style={s.gridDividerV} />
              <FinStat label={t('report.cancels')} value={fmt$(shift.cancels)} />
            </View>
            <View style={s.gridDividerH} />
            <View style={s.gridRow}>
              <FinStat label={t('report.expectedCash')} value={fmt$(shift.expected_cash)} />
              <View style={s.gridDividerV} />
              <FinStat label={t('report.cashInHand')} value={fmt$(shift.cash_in_hand)} />
            </View>
          </View>

          {/* Difference row */}
          <View style={[s.diffRow, { backgroundColor: diffBg }]}>
            <Text style={s.diffLabel}>{t('report.difference')}</Text>
            <Text style={[s.diffValue, { color: diffClr }]}>{diffAmt}</Text>
          </View>
        </View>

        {/* ── Employee Info Card ───────────────────────────────────────── */}
        <View style={s.employeeCard}>
          <View style={s.empAvatar}>
            <Text style={s.empAvatarText}>{getInitials(shift.opened_by?.username)}</Text>
          </View>
          <View style={s.empInfo}>
            <Text style={s.empName}>{empName}</Text>
            <Text style={s.empTimes}>
              {t('report.started')}: {formatLocalTime(shift.opened_at)}
              {shift.closed_at ? `  ·  ${t('report.ended')}: ${formatLocalTime(shift.closed_at)}` : ''}
            </Text>
            {shift.opened_at && (
              <Text style={s.empDuration}>
                Duration: {shiftDuration(shift.opened_at, shift.closed_at)}
              </Text>
            )}
          </View>
        </View>

        {/* ── Books Section ────────────────────────────────────────────── */}
        {shift.books?.length > 0 && (
          <>
            <SectionHeader
              title={t('report.books')}
              count={`${shift.books.length} books`}
            />
            {shift.books.map((b, i) => (
              <BookCard key={i} book={b} />
            ))}
          </>
        )}

        {/* ── Totals Section ───────────────────────────────────────────── */}
        <SectionHeader title={t('report.totals')} />
        <View style={s.totalsCard}>
          <TotalsRow label={t('report.ticketsTotal')} value={fmt$(shift.tickets_total)} />
          <TotalsRow label={t('report.grossSales')}   value={fmt$(shift.gross_sales)} />
          <TotalsRow label={t('report.cashInHand')}   value={fmt$(shift.cash_in_hand)} />
          {shift.cancels != null && (
            <TotalsRow label={t('report.cancels')} value={fmt$(shift.cancels)} />
          )}
          <TotalsRow label={t('report.expectedCash')} value={fmt$(shift.expected_cash)} />
          <TotalsRow
            label={t('report.difference')}
            value={diffAmt}
            valueColor={diffClr}
            isLast
          />
        </View>

        {/* ── Ticket Breakdown ─────────────────────────────────────────── */}
        {shift.ticket_breakdown?.length > 0 && (
          <>
            <SectionHeader title={t('report.ticketBreakdown')} />
            <View style={s.totalsCard}>
              {shift.ticket_breakdown.map((row, i) => (
                <TotalsRow
                  key={i}
                  label={`$${row.ticket_price} · ${row.source}`}
                  value={`${row.tickets_sold} → ${fmt$(row.subtotal)}`}
                  isLast={i === shift.ticket_breakdown.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Slot Information ─────────────────────────────────────────── */}
        {shift.slot_information?.length > 0 && (
          <>
            <SectionHeader
              title="Slot Information"
              count={`${shift.slot_information.length}`}
            />
            {shift.slot_information.map((item, i) => (
              <SlotCard key={i} item={item} />
            ))}
          </>
        )}

        {/* ── Whole Book Sales ─────────────────────────────────────────── */}
        {shift.whole_book_sales?.length > 0 && (
          <>
            <SectionHeader
              title={t('report.wholeBookSales')}
              count={`${shift.whole_book_sales.length}`}
            />
            {shift.whole_book_sales.map((sale, i) => (
              <WholeSaleCard key={sale.extra_sale_id ?? i} sale={sale} />
            ))}
          </>
        )}

        {/* ── Returned Books ───────────────────────────────────────────── */}
        {shift.returned_books?.length > 0 && (
          <>
            <SectionHeader
              title={t('report.returnedBooks')}
              count={`${shift.returned_books.length}`}
            />
            <View style={s.totalsCard}>
              {shift.returned_books.map((r, i) => (
                <ReturnedBookRow
                  key={r.book_id ?? i}
                  book={r}
                  isLast={i === shift.returned_books.length - 1}
                  t={t}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 88 }} />
      </ScrollView>

      {/* ── Fixed Export Button ──────────────────────────────────────────── */}
      <View style={s.exportWrap}>
        <TouchableOpacity
          style={[s.exportBtn, exporting && s.dimmed]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.exportBtnText}>📤  {t('report.export.button')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ shift, t }) {
  if (shift.voided) {
    return <Pill label="Voided" bg="#FEE2E2" color="#7C2D12" />;
  }
  if (shift.shift_status === 'correct') {
    return <Pill label={`✓ ${t('history.statusCorrect')}`} bg="#DCFCE7" color={D.SUCCESS} />;
  }
  if (shift.shift_status === 'short') {
    return <Pill label={`✗ ${t('history.statusShort')}`} bg="#FEE2E2" color={D.ERROR} />;
  }
  if (shift.shift_status === 'over') {
    return <Pill label={`↑ ${t('history.statusOver')}`} bg="#FEF3C7" color={D.WARNING} />;
  }
  if (shift.status === 'open') {
    return <Pill label="● Active" bg="#DBEAFE" color={D.PRIMARY} />;
  }
  return null;
}

function Pill({ label, bg, color }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ title, count }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!count && (
        <View style={s.sectionCountPill}>
          <Text style={s.sectionCountText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ── FinStat (grid cell) ───────────────────────────────────────────────────────

function FinStat({ label, value }) {
  return (
    <View style={s.finStat}>
      <Text style={s.finStatValue}>{value}</Text>
      <Text style={s.finStatLabel}>{label}</Text>
    </View>
  );
}

// ── BookCard ──────────────────────────────────────────────────────────────────

function BookCard({ book: b }) {
  const isActive  = b.close_position == null;
  const isSold    = b.fully_sold;

  return (
    <View style={s.bookCard}>
      <View style={s.bookCardRow}>
        {/* Left */}
        <View style={s.bookCardLeft}>
          <Text style={s.bookSlotName}>{b.slot_name}</Text>
          <Text style={s.bookCode}>{b.static_code}</Text>
          <View style={s.pricePill}>
            <Text style={s.pricePillText}>${b.ticket_price}</Text>
          </View>
        </View>

        {/* Right */}
        <View style={s.bookCardRight}>
          {isActive ? (
            <View style={s.bookBadgeActive}>
              <Text style={s.bookBadgeActiveText}>Active</Text>
            </View>
          ) : (
            <View style={s.bookBadgeSold}>
              <Text style={s.bookBadgeSoldText}>
                {isSold ? 'Sold' : 'Closed'}
              </Text>
            </View>
          )}
          {isSold ? (
            <Text style={s.bookSoldLabel}>📦 Book Sold</Text>
          ) : b.tickets_sold > 0 ? (
            <Text style={s.bookTicketsLabel}>{b.tickets_sold} Tickets Sold</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── TotalsRow ─────────────────────────────────────────────────────────────────

function TotalsRow({ label, value, valueColor, isLast }) {
  return (
    <View style={[s.totalsRow, !isLast && s.totalsRowBorder]}>
      <Text style={s.totalsKey}>{label}</Text>
      <Text style={[s.totalsVal, valueColor && { color: valueColor }]}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

function SlotCard({ item }) {
  return (
    <View style={s.slotCard}>
      <View style={s.slotCardHeader}>
        <Text style={s.slotCardName}>{item.slot_name}</Text>
        <Text style={s.slotCardPrice}>${item.ticket_price}</Text>
      </View>

      <SlotKV label="Slot Created"  value={item.slot_created_at ? formatLocalDateTime(item.slot_created_at) : '—'} />
      <SlotKV label="Book Assigned" value={item.assigned_at     ? formatLocalDateTime(item.assigned_at)     : '—'} />
      <SlotKV label="Assigned By"   value={item.assigned_by} />
      <SlotKV label="Barcode"       value={item.book_barcode} />

      <View style={s.slotSectionDiv} />

      <SlotKV label="Open Position"  value={item.open_position  ?? '—'} />
      <SlotKV label="Close Position" value={item.close_position ?? '—'} />
      <SlotKV label="Tickets Sold"   value={item.tickets_sold} />

      <View style={s.slotSubtotalRow}>
        <Text style={s.slotSubtotalLabel}>Subtotal</Text>
        <Text style={s.slotSubtotalValue}>${item.subtotal}</Text>
      </View>

      {item.is_last_ticket && (
        <View style={s.lastTicketBadge}>
          <Text style={s.lastTicketText}>🎯 Last Ticket Sold</Text>
        </View>
      )}
    </View>
  );
}

function SlotKV({ label, value }) {
  return (
    <View style={s.slotKV}>
      <Text style={s.slotKVKey}>{label}</Text>
      <Text style={s.slotKVVal}>{value ?? '—'}</Text>
    </View>
  );
}

// ── WholeSaleCard ─────────────────────────────────────────────────────────────

function WholeSaleCard({ sale }) {
  return (
    <View style={s.bookCard}>
      <View style={s.bookCardRow}>
        <View style={s.bookCardLeft}>
          <Text style={s.bookSlotName}>{sale.scanned_barcode}</Text>
          <Text style={s.bookCode}>
            ${sale.ticket_price} · {sale.ticket_count} tickets
          </Text>
          {sale.created_by?.username && (
            <Text style={s.bookCode}>{sale.created_by.username}</Text>
          )}
        </View>
        <Text style={s.wbSaleValue}>{fmt$(sale.value)}</Text>
      </View>
    </View>
  );
}

// ── ReturnedBookRow ───────────────────────────────────────────────────────────

function ReturnedBookRow({ book: r, isLast, t }) {
  return (
    <View style={[s.totalsRow, !isLast && s.totalsRowBorder]}>
      <View>
        <Text style={s.totalsKey}>{r.static_code}</Text>
        <Text style={[s.totalsKey, { fontSize: FS.xs }]}>
          {r.slot_name} · ${r.ticket_price} · {r.open_position} → {r.returned_at_position}
        </Text>
        <Text style={[s.totalsKey, { fontSize: FS.xs }]}>
          {t('report.soldBeforeReturn', { count: r.tickets_sold })}
        </Text>
      </View>
      <Text style={s.totalsVal}>{fmt$(r.value)}</Text>
    </View>
  );
}

// ── PDF builder (unchanged) ────────────────────────────────────────────────────

function buildReportHtml(report, t, isRTL) {
  const shift = report.shift;
  const businessDay = report.business_day;

  function esc(v) {
    if (v === null || v === undefined) return '—';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(v) {
    if (v === null || v === undefined) return '—';
    const n = parseFloat(v);
    return Number.isNaN(n) ? '—' : `$${n.toFixed(2)}`;
  }

  function fmtTime(iso) {
    return formatLocalDateTime(iso);
  }

  function badge(status, voided) {
    if (voided) return `<span class="badge voided">${esc(t('history.statusVoided'))}</span>`;
    if (status === 'correct') return `<span class="badge correct">${esc(t('history.statusCorrect'))}</span>`;
    if (status === 'over') return `<span class="badge over">${esc(t('history.statusOver'))}</span>`;
    if (status === 'short') return `<span class="badge short">${esc(t('history.statusShort'))}</span>`;
    return '';
  }

  function kvRow(label, value, cls = '') {
    return `<div class="row"><span class="label">${esc(label)}</span><span class="value${cls ? ' ' + cls : ''}">${esc(value)}</span></div>`;
  }

  function diffCls(status) {
    if (status === 'correct') return 'correct';
    if (status === 'over') return 'over';
    if (status === 'short') return 'short';
    return '';
  }

  function sectionLabel(text) {
    return `<p class="section-label">${esc(text)}</p>`;
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body = '';

  // Shift header
  const dateLabel = businessDay ? `<p class="date-label">${esc(formatBusinessDate(businessDay.business_date))}</p>` : '';
  body += `<div class="card"><div class="header-row"><div>${dateLabel}<h1>${esc(t('report.subshiftTitle', { number: shift.shift_number }))}</h1></div>${badge(shift.shift_status, shift.voided)}</div>${kvRow(t('report.started'), fmtTime(shift.opened_at))}${kvRow(t('report.ended'), fmtTime(shift.closed_at))}${kvRow(t('report.openedBy'), shift.opened_by?.username)}${kvRow(t('report.closedBy'), shift.closed_by?.username)}</div>`;

  // Totals
  const cancelsRow = shift.cancels != null ? kvRow(t('report.cancels'), money(shift.cancels)) : '';
  body += `<h2>${esc(t('report.totals'))}</h2><div class="card">${kvRow(t('report.ticketsTotal'), money(shift.tickets_total))}${kvRow(t('report.grossSales'), money(shift.gross_sales))}${kvRow(t('report.cashInHand'), money(shift.cash_in_hand))}${cancelsRow}${kvRow(t('report.expectedCash'), money(shift.expected_cash))}${kvRow(t('report.difference'), money(shift.difference), diffCls(shift.shift_status))}</div>`;

  // Ticket breakdown
  if (shift.ticket_breakdown?.length > 0) {
    body += `<h2>${esc(t('report.ticketBreakdown'))}</h2><div class="card">`;
    for (const bd of shift.ticket_breakdown) {
      body += `<div class="row"><span class="label">$${esc(bd.ticket_price)} · ${esc(bd.source)}</span><span class="value">${esc(bd.tickets_sold)} → ${money(bd.subtotal)}</span></div>`;
    }
    body += `</div>`;
  }

  // Books
  if (shift.books?.length > 0) {
    body += `<h2>${esc(t('report.books'))}</h2><div class="card">`;
    for (const b of shift.books) {
      const meta = `${esc(b.slot_name)} · $${esc(b.ticket_price)} · ${esc(b.open_position)} → ${esc(b.close_position)} · ${esc(t('report.subshiftFooter', { count: b.tickets_sold }))}${b.fully_sold ? ' · ' + esc(t('report.soldOut')) : ''}`;
      body += `<div class="book-row"><div class="book-header"><span>${esc(b.static_code)}</span><span>${money(b.value)}</span></div><div class="book-meta">${meta}</div></div>`;
    }
    body += `</div>`;
  }

  // Whole book sales
  if (shift.whole_book_sales?.length > 0) {
    body += `<h2>${esc(t('report.wholeBookSales'))}</h2><div class="card">`;
    for (const s of shift.whole_book_sales) {
      body += `<div class="book-row"><div class="book-header"><span>${esc(s.scanned_barcode)}</span><span>${money(s.value)}</span></div><div class="book-meta">$${esc(s.ticket_price)} · ${esc(s.ticket_count)} · ${esc(s.created_by?.username)}</div></div>`;
    }
    body += `</div>`;
  }

  // Returned books
  if (shift.returned_books?.length > 0) {
    body += `<h2>${esc(t('report.returnedBooks'))}</h2><div class="card">`;
    for (const r of shift.returned_books) {
      const meta = `${esc(r.slot_name)} · $${esc(r.ticket_price)} · ${esc(r.open_position)} → ${esc(r.returned_at_position)} · ${esc(t('report.soldBeforeReturn', { count: r.tickets_sold }))}`;
      body += `<div class="book-row"><div class="book-header"><span>${esc(r.static_code)}</span><span>${money(r.value)}</span></div><div class="book-meta">${meta}</div></div>`;
    }
    body += `</div>`;
  }

  body += `<div class="footer">${esc(t('report.export.generatedAt'))}: ${new Date().toLocaleString()}</div>`;

  // ── CSS ───────────────────────────────────────────────────────────────────
  const fontFamily = isRTL
    ? "'Geeza Pro', 'Arabic UI Text', Tahoma, sans-serif"
    : "'-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', Arial, sans-serif";

  return `<!DOCTYPE html>
<html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(t('report.subshiftTitle', { number: shift.shift_number }))}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${fontFamily}; font-size: 13px; color: #222; background: #f4f5f7; padding: 24px; direction: ${isRTL ? 'rtl' : 'ltr'}; }
h1 { font-size: 20px; font-weight: 700; }
h2 { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 6px; }
h3 { font-size: 14px; font-weight: 700; color: #222; }
.card { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
.voided-card { opacity: 0.7; }
.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f5f5f5; }
.row:last-child { border-bottom: none; }
.label { color: #666; }
.value { font-weight: 600; }
.value.correct { color: #166534; }
.value.over { color: #b45309; }
.value.short { color: #dc2626; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.badge.correct { background: #dcfce7; color: #166534; }
.badge.over { background: #fef3c7; color: #b45309; }
.badge.short { background: #fef2f2; color: #dc2626; }
.badge.voided { background: #fee2e2; color: #7c2d12; }
hr.divider { border: none; border-top: 1px solid #eee; margin: 10px 0; }
.section-label { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.book-row { padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
.book-row:last-child { border-bottom: none; }
.book-header { display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; }
.book-meta { font-size: 11px; color: #666; margin-top: 2px; }
.date-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
.footer { text-align: center; color: #aaa; font-size: 11px; margin-top: 24px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: D.BACKGROUND },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SP.md },
  dimmed:   { opacity: 0.5 },

  loadingText: { fontSize: FS.sm, color: D.SUBTLE },
  errorEmoji:  { fontSize: 48, marginBottom: SP.sm },
  errorText:   { fontSize: FS.md, color: D.TEXT, textAlign: 'center', marginBottom: SP.lg },
  retryBtn: {
    paddingHorizontal: SP.xl,
    paddingVertical: SP.sm,
    borderRadius: BR.full,
    borderWidth: 1.5,
    borderColor: D.PRIMARY,
  },
  retryBtnText: { fontSize: FS.sm, fontWeight: FW.semibold, color: D.PRIMARY },

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
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  backArrow: { fontSize: FS.xl, color: D.PRIMARY, lineHeight: 26 },
  backLabel: { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: { fontSize: FS.lg, fontWeight: FW.bold, color: D.PRIMARY, lineHeight: 22 },

  // scroll
  scroll: { padding: SP.lg, paddingBottom: 20 },

  // ── summary card ────────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    marginBottom: SP.md,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  summaryBar:    { height: 4 },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SP.lg,
  },
  summaryLeft:     { flex: 1, marginRight: SP.sm },
  summaryShiftNum: { fontSize: FS.xl, fontWeight: FW.bold, color: D.TEXT, marginBottom: 3 },
  summaryDate:     { fontSize: FS.sm, color: D.SUBTLE, marginBottom: 2 },
  summaryTime:     { fontSize: FS.sm, color: D.SUBTLE },

  pill:     { paddingHorizontal: SP.md, paddingVertical: 4, borderRadius: BR.full },
  pillText: { fontSize: FS.sm, fontWeight: FW.semibold },

  cardDivider: { height: 1, backgroundColor: D.BORDER },

  // financials grid
  financialGrid: { padding: SP.lg },
  gridRow: { flexDirection: 'row' },
  gridDividerV: { width: 1, backgroundColor: D.BORDER, marginVertical: SP.xs },
  gridDividerH: { height: 1, backgroundColor: D.BORDER, marginVertical: SP.md },
  finStat:      { flex: 1, alignItems: 'center', paddingHorizontal: SP.sm },
  finStatValue: { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT, marginBottom: 2, textAlign: 'center' },
  finStatLabel: { fontSize: FS.xs, color: D.SUBTLE, textAlign: 'center' },

  // difference row
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SP.md,
    paddingHorizontal: SP.lg,
  },
  diffLabel: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT },
  diffValue: { fontSize: FS.lg, fontWeight: FW.bold },

  // ── employee card ────────────────────────────────────────────────────────────
  employeeCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    marginBottom: SP.md,
    padding: SP.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  empAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: D.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SP.md,
  },
  empAvatarText: { fontSize: FS.sm, fontWeight: FW.bold, color: '#fff' },
  empInfo:       { flex: 1 },
  empName:       { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT, marginBottom: 2 },
  empTimes:      { fontSize: FS.sm, color: D.SUBTLE, marginBottom: 1 },
  empDuration:   { fontSize: FS.sm, color: D.SUBTLE },

  // ── section header ────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SP.xs,
    marginBottom: SP.sm,
    marginTop: SP.xs,
  },
  sectionTitle:     { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT },
  sectionCountPill: { backgroundColor: D.BORDER, paddingHorizontal: SP.sm, paddingVertical: 2, borderRadius: BR.full },
  sectionCountText: { fontSize: FS.xs, color: D.SUBTLE, fontWeight: FW.medium },

  // ── book card ────────────────────────────────────────────────────────────────
  bookCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    marginBottom: SP.sm,
    padding: SP.lg,
    ...CARD_SHADOW,
  },
  bookCardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bookCardLeft:  { flex: 1, marginRight: SP.sm },
  bookCardRight: { alignItems: 'flex-end', gap: SP.xs },
  bookSlotName:  { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT, marginBottom: 2 },
  bookCode:      { fontSize: FS.sm, color: D.SUBTLE, marginBottom: SP.xs },
  pricePill:     { backgroundColor: '#DBEAFE', paddingHorizontal: SP.sm, paddingVertical: 2, borderRadius: BR.full, alignSelf: 'flex-start' },
  pricePillText: { fontSize: FS.xs, fontWeight: FW.semibold, color: D.PRIMARY },

  bookBadgeActive:     { backgroundColor: '#DCFCE7', paddingHorizontal: SP.sm, paddingVertical: 3, borderRadius: BR.full },
  bookBadgeActiveText: { fontSize: FS.xs, fontWeight: FW.semibold, color: D.SUCCESS },
  bookBadgeSold:       { backgroundColor: D.BORDER, paddingHorizontal: SP.sm, paddingVertical: 3, borderRadius: BR.full },
  bookBadgeSoldText:   { fontSize: FS.xs, fontWeight: FW.semibold, color: D.SUBTLE },
  bookSoldLabel:       { fontSize: FS.sm, color: D.SUBTLE },
  bookTicketsLabel:    { fontSize: FS.sm, fontWeight: FW.bold, color: D.ERROR },
  wbSaleValue:         { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT },

  // ── totals card ───────────────────────────────────────────────────────────────
  totalsCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    marginBottom: SP.md,
    ...CARD_SHADOW,
    overflow: 'hidden',
  },
  totalsRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SP.md, paddingHorizontal: SP.lg },
  totalsRowBorder: { borderBottomWidth: 1, borderBottomColor: D.BORDER },
  totalsKey:       { fontSize: FS.sm, color: D.SUBTLE },
  totalsVal:       { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT },

  // ── slot card ─────────────────────────────────────────────────────────────────
  slotCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    marginBottom: SP.sm,
    padding: SP.lg,
    ...CARD_SHADOW,
  },
  slotCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.sm },
  slotCardName:     { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT, flex: 1 },
  slotCardPrice:    { fontSize: FS.sm, fontWeight: FW.semibold, color: D.PRIMARY },
  slotSectionDiv:   { height: 1, backgroundColor: D.BORDER, marginVertical: SP.sm },
  slotKV:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  slotKVKey:        { fontSize: FS.sm, color: D.SUBTLE },
  slotKVVal:        { fontSize: FS.sm, fontWeight: FW.semibold, color: D.TEXT },
  slotSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: D.BACKGROUND,
    borderRadius: BR.sm,
    padding: SP.sm,
    marginTop: SP.sm,
  },
  slotSubtotalLabel: { fontSize: FS.sm, fontWeight: FW.bold, color: D.TEXT },
  slotSubtotalValue: { fontSize: FS.sm, fontWeight: FW.bold, color: D.TEXT },
  lastTicketBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: BR.sm,
    paddingHorizontal: 10,
    paddingVertical: SP.xs,
    alignSelf: 'flex-start',
    marginTop: SP.sm,
  },
  lastTicketText: { fontSize: FS.xs, fontWeight: FW.semibold, color: D.WARNING },

  // ── export button (fixed bottom) ──────────────────────────────────────────────
  exportWrap: {
    paddingHorizontal: SP.lg,
    paddingTop: SP.sm,
    paddingBottom: SP.lg,
    backgroundColor: D.BACKGROUND,
  },
  exportBtn: {
    height: 52,
    backgroundColor: D.PRIMARY,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportBtnText: { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },
});
