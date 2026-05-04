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
import { formatLocalDateTime, formatBusinessDate } from '../utils/dateTime';
import { useAuth } from '../context/AuthContext';
import { getDb } from '../offline/db';

export default function ReportDetailScreen({ route }) {
  const { t, i18n } = useTranslation();
  const { shiftId } = route.params;
  const navigation = useNavigation();
  const { isOffline, store } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [report, setReport] = useState(null);

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

        const openScans = scans.filter(s => s.scan_type === 'open');
        const closeScans = scans.filter(s => s.scan_type === 'close');

        const books = openScans.map(openScan => {
          const closeScan = closeScans.find(c => c.static_code === openScan.static_code);
          const ticketsSold = closeScan
            ? (closeScan.is_last_ticket
                ? closeScan.start_at_scan - openScan.start_at_scan + 1
                : closeScan.start_at_scan - openScan.start_at_scan)
            : 0;
          return {
            static_code: openScan.static_code,
            slot_name: openScan.slot_name || `#${openScan.slot_id}`,
            ticket_price: openScan.ticket_price,
            open_position: openScan.start_at_scan,
            close_position: closeScan?.start_at_scan,
            tickets_sold: ticketsSold,
            value: (ticketsSold * parseFloat(openScan.ticket_price)).toFixed(2),
            fully_sold: !!closeScan?.is_last_ticket,
          };
        });

        setReport({
          shift: {
            id: localShift.server_id || localShift.id,
            uuid: localShift.uuid,
            shift_number: localShift.shift_number,
            status: localShift.status,
            opened_at: localShift.opened_at,
            closed_at: localShift.closed_at,
            cash_in_hand: localShift.cash_in_hand,
            gross_sales: localShift.gross_sales,
            cash_out: localShift.cash_out,
            cancels: localShift.cancels,
            tickets_total: localShift.tickets_total,
            expected_cash: localShift.expected_cash,
            difference: localShift.difference,
            shift_status: localShift.shift_status,
            employee_id: localShift.employee_id,
            books,
            whole_book_sales: extraSales.map(s => ({
              scanned_barcode: s.scanned_barcode,
              ticket_price: s.ticket_price,
              ticket_count: s.ticket_count,
              value: s.value,
            })),
            returned_books: [],
            ticket_breakdown: [],
          },
          business_day: localDay ? {
            id: localDay.server_id,
            uuid: localDay.uuid,
            business_date: localDay.business_date,
            status: localDay.status,
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
          mimeType: 'application/pdf',
          dialogTitle: t('report.export.shareTitle'),
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err) {
      Alert.alert(t('report.export.errorTitle'), err.message || t('common.tryAgain'));
    } finally {
      setExporting(false);
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

  if (!report || !report.shift) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>{t('report.reportNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const shift = report.shift;
  const businessDay = report.business_day;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('report.back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.printButton, printing && styles.actionButtonDisabled]}
            onPress={handlePrint}
            disabled={printing}
          >
            {printing
              ? <ActivityIndicator size="small" color="#1a73e8" />
              : <Text style={styles.printButtonText}>{t('report.export.printButton')}</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.actionButtonDisabled]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.exportButtonText}>{t('report.export.button')}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              {businessDay && (
                <Text style={styles.dateText}>{formatBusinessDate(businessDay.business_date)}</Text>
              )}
              <Text style={styles.title}>
                {t('report.subshiftTitle', { number: shift.shift_number })}
              </Text>
            </View>
            <StatusBadge status={shift.shift_status} voided={shift.voided} t={t} />
          </View>
          <KV k={t('report.started')} v={formatLocalDateTime(shift.opened_at)} />
          <KV k={t('report.ended')} v={formatLocalDateTime(shift.closed_at)} />
          <KV k={t('report.openedBy')} v={shift.opened_by?.username} />
          <KV k={t('report.closedBy')} v={shift.closed_by?.username} />
        </View>

        <SectionTitle text={t('report.totals')} />
        <View style={styles.card}>
          <KV k={t('report.ticketsTotal')} v={fmt$(shift.tickets_total)} />
          <KV k={t('report.grossSales')} v={fmt$(shift.gross_sales)} />
          <KV k={t('report.cashInHand')} v={fmt$(shift.cash_in_hand)} />
          {shift.cancels != null && (
            <KV k={t('report.cancels')} v={fmt$(shift.cancels)} />
          )}
          <KV k={t('report.expectedCash')} v={fmt$(shift.expected_cash)} />
          <KV
            k={t('report.difference')}
            v={fmt$(shift.difference)}
            vColor={diffColor(shift.shift_status)}
          />
        </View>

        {shift.ticket_breakdown?.length > 0 && (
          <>
            <SectionTitle text={t('report.ticketBreakdown')} />
            <View style={styles.card}>
              {shift.ticket_breakdown.map((row, i) => (
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

        {shift.books?.length > 0 && (
          <>
            <SectionTitle text={t('report.books')} />
            <View style={styles.card}>
              {shift.books.map((b, i) => (
                <View key={i} style={styles.bookRow}>
                  <View style={styles.bookHeader}>
                    <Text style={styles.bookCode}>{b.static_code}</Text>
                    <Text style={styles.bookValue}>{fmt$(b.value)}</Text>
                  </View>
                  <Text style={styles.bookMeta}>
                    {b.slot_name} · ${b.ticket_price} · {b.open_position} → {b.close_position} · {t('report.subshiftFooter', { count: b.tickets_sold })}
                    {b.fully_sold && ' · ' + t('report.soldOut')}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {shift.whole_book_sales?.length > 0 && (
          <>
            <SectionTitle text={t('report.wholeBookSales')} />
            <View style={styles.card}>
              {shift.whole_book_sales.map((s) => (
                <View key={s.extra_sale_id} style={styles.bookRow}>
                  <View style={styles.bookHeader}>
                    <Text style={styles.bookCode}>{s.scanned_barcode}</Text>
                    <Text style={styles.bookValue}>{fmt$(s.value)}</Text>
                  </View>
                  <Text style={styles.bookMeta}>
                    ${s.ticket_price} · {s.ticket_count} · {s.created_by?.username}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {shift.returned_books?.length > 0 && (
          <>
            <SectionTitle text={t('report.returnedBooks')} />
            <View style={styles.card}>
              {shift.returned_books.map((r) => (
                <View key={r.book_id} style={styles.bookRow}>
                  <View style={styles.bookHeader}>
                    <Text style={styles.bookCode}>{r.static_code}</Text>
                    <Text style={styles.bookValue}>{fmt$(r.value)}</Text>
                  </View>
                  <Text style={styles.bookMeta}>
                    {r.slot_name} · ${r.ticket_price} · {r.open_position} → {r.returned_at_position} · {t('report.soldBeforeReturn', { count: r.tickets_sold })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {shift.slot_information?.length > 0 && (
          <>
            <SectionTitle text="Slot Information" />
            {shift.slot_information.map((item, index) => (
              <View key={index} style={styles.slotCard}>
                <View style={styles.slotHeader}>
                  <Text style={styles.slotName}>{item.slot_name}</Text>
                  <Text style={styles.slotTicketPrice}>${item.ticket_price}</Text>
                </View>

                <SlotRow label="Slot Created"   value={item.slot_created_at ? formatLocalDateTime(item.slot_created_at) : '—'} />
                <SlotRow label="Book Assigned"  value={item.assigned_at ? formatLocalDateTime(item.assigned_at) : '—'} />
                <SlotRow label="Assigned By"    value={item.assigned_by} />
                <SlotRow label="Barcode"        value={item.book_barcode} />

                <View style={styles.slotDivider} />

                <SlotRow label="Open Position"  value={item.open_position ?? '—'} />
                <SlotRow label="Close Position" value={item.close_position ?? '—'} />
                <SlotRow label="Tickets Sold"   value={item.tickets_sold} />
                <View style={styles.slotTotalRow}>
                  <Text style={styles.slotTotalLabel}>Subtotal</Text>
                  <Text style={styles.slotTotalValue}>${item.subtotal}</Text>
                </View>

                {item.is_last_ticket && (
                  <View style={styles.lastTicketBadge}>
                    <Text style={styles.lastTicketText}>Last Ticket Sold</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status, voided, t }) {
  let color = '#888';
  let bg = '#f0f0f0';
  let text = '—';

  if (voided) {
    text = t('history.statusVoided');
    color = '#7c2d12';
    bg = '#fee2e2';
  } else if (status === 'correct') {
    text = t('history.statusCorrect');
    color = '#166534';
    bg = '#dcfce7';
  } else if (status === 'over') {
    text = t('history.statusOver');
    color = '#b45309';
    bg = '#fef3c7';
  } else if (status === 'short') {
    text = t('history.statusShort');
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

function SlotRow({ label, value }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{label}</Text>
      <Text style={styles.kvValue}>{value ?? '—'}</Text>
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

// ---------------------------------------------------------------------------
// PDF HTML builder
// ---------------------------------------------------------------------------

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

  // Slot information
  if (shift.slot_information?.length > 0) {
    body += `<h2>Slot Information</h2>`;
    for (const item of shift.slot_information) {
      body += `<div class="card slot-card">`;
      body += `<div class="slot-header"><span class="slot-name">${esc(item.slot_name)}</span><span class="slot-price">$${esc(item.ticket_price)}</span></div>`;
      body += kvRow('Slot Created', item.slot_created_at ? fmtTime(item.slot_created_at) : '—');
      body += kvRow('Book Assigned', item.assigned_at ? fmtTime(item.assigned_at) : '—');
      body += kvRow('Assigned By', item.assigned_by || '—');
      body += kvRow('Barcode', item.book_barcode || '—');
      body += `<hr class="divider" />`;
      body += kvRow('Open Position', item.open_position ?? '—');
      body += kvRow('Close Position', item.close_position ?? '—');
      body += kvRow('Tickets Sold', item.tickets_sold);
      body += `<div class="slot-total-row"><span class="slot-total-label">Subtotal</span><span class="slot-total-value">$${esc(item.subtotal)}</span></div>`;
      if (item.is_last_ticket) {
        body += `<span class="last-ticket-badge">Last Ticket Sold</span>`;
      }
      body += `</div>`;
    }
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
.slot-card { border-left: 3px solid #1a73e8; }
.slot-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.slot-name { font-size: 15px; font-weight: 700; color: #222; }
.slot-price { font-size: 13px; font-weight: 700; color: #1a73e8; }
.slot-total-row { display: flex; justify-content: space-between; padding: 6px 0; margin-top: 4px; }
.slot-total-label { font-size: 13px; font-weight: 700; color: #333; }
.slot-total-value { font-size: 14px; font-weight: 700; color: #222; }
.last-ticket-badge { display: inline-block; background: #dcfce7; color: #166534; border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: 700; margin-top: 8px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1a73e8',
    minWidth: 44,
    alignItems: 'center',
  },
  printButtonText: { color: '#1a73e8', fontSize: 13, fontWeight: '600' },
  exportButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
    minWidth: 44,
    alignItems: 'center',
  },
  exportButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionButtonDisabled: { opacity: 0.5 },

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
  dateText: { fontSize: 12, color: '#888', fontWeight: '500', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
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

  slotCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#1a73e8',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotName: { fontSize: 16, fontWeight: '700', color: '#222', flex: 1 },
  slotTicketPrice: { fontSize: 14, fontWeight: '700', color: '#1a73e8' },
  slotDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ddd',
    marginVertical: 8,
  },
  slotTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
  },
  slotTotalLabel: { fontSize: 13, fontWeight: '700', color: '#333' },
  slotTotalValue: { fontSize: 14, fontWeight: '700', color: '#222' },
  lastTicketBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  lastTicketText: { fontSize: 11, fontWeight: '700', color: '#166534' },
});
