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

export default function ReportDetailScreen({ route }) {
  const { t, i18n } = useTranslation();
  const { shiftId } = route.params;
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [report, setReport] = useState(null);

  const loadReport = useCallback(async () => {
    try {
      const data = await getShiftReport(shiftId);
      setReport(data);
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('report.errorLoadingReport'));
    }
  }, [shiftId, t]);

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

      const dateStr = report.main_shift.shift_start_time
        ? new Date(report.main_shift.shift_start_time).toISOString().split('T')[0]
        : `shift-${report.main_shift.shift_id}`;
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

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>{t('report.reportNotFound')}</Text>
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
            <Text style={styles.title}>
              {t('report.mainShiftTitle', { id: main.shift_id })}
            </Text>
            <StatusBadge status={totals.shift_status} voided={main.voided} t={t} />
          </View>
          <KV k={t('report.started')} v={formatTime(main.shift_start_time)} />
          <KV k={t('report.ended')} v={formatTime(main.shift_end_time)} />
          <KV k={t('report.openedBy')} v={main.opened_by?.username} />
        </View>

        <SectionTitle text={t('report.totals')} />
        <View style={styles.card}>
          <KV k={t('report.ticketsTotal')} v={fmt$(totals.tickets_total)} />
          <KV k={t('report.grossSales')} v={fmt$(totals.gross_sales)} />
          <KV k={t('report.cashInHand')} v={fmt$(totals.cash_in_hand)} />
          <KV k={t('report.expectedCash')} v={fmt$(totals.expected_cash)} />
          <KV
            k={t('report.difference')}
            v={fmt$(totals.difference)}
            vColor={diffColor(totals.shift_status)}
          />
        </View>

        {main.ticket_breakdown?.length > 0 && (
          <>
            <SectionTitle text={t('report.ticketBreakdown')} />
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

        {subshifts.length > 0 && (
          <>
            <SectionTitle text={t('report.subshifts')} />
            {subshifts.map((sub) => (
              <SubshiftCard key={sub.shift_id} sub={sub} t={t} />
            ))}
          </>
        )}

        {voidedSubshifts.length > 0 && (
          <>
            <SectionTitle text={t('report.voidedSubshifts')} />
            {voidedSubshifts.map((sub) => (
              <View key={sub.shift_id} style={[styles.card, styles.voidedCard]}>
                <View style={styles.headerRow}>
                  <Text style={styles.subTitle}>
                    {t('report.subshiftTitle', { number: sub.shift_number })}
                  </Text>
                  <View style={styles.voidedBadge}>
                    <Text style={styles.voidedText}>{t('report.voidedBadge')}</Text>
                  </View>
                </View>
                <KV k={t('report.reason')} v={sub.void_reason || '—'} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (unchanged from original)
// ---------------------------------------------------------------------------

function SubshiftCard({ sub, t }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.subTitle}>
          {t('report.subshiftTitle', { number: sub.shift_number })}
        </Text>
        <StatusBadge status={sub.shift_status} voided={sub.voided} t={t} />
      </View>

      <KV k={t('report.openedBy')} v={sub.opened_by?.username} />
      <KV k={t('report.closedBy')} v={sub.closed_by?.username} />
      <KV k={t('report.started')} v={formatTime(sub.shift_start_time)} />
      <KV k={t('report.ended')} v={formatTime(sub.shift_end_time)} />

      <View style={styles.divider} />

      <KV k={t('report.cashInHand')} v={fmt$(sub.cash_in_hand)} />
      <KV k={t('report.grossSales')} v={fmt$(sub.gross_sales)} />
      <KV k={t('report.cashOut')} v={fmt$(sub.cash_out)} />
      <KV k={t('report.ticketsTotal')} v={fmt$(sub.tickets_total)} />
      <KV k={t('report.expectedCash')} v={fmt$(sub.expected_cash)} />
      <KV
        k={t('report.difference')}
        v={fmt$(sub.difference)}
        vColor={diffColor(sub.shift_status)}
      />

      {sub.books?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>{t('report.books')}</Text>
          {sub.books.map((b, i) => (
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
        </>
      )}

      {sub.whole_book_sales?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>{t('report.wholeBookSales')}</Text>
          {sub.whole_book_sales.map((s) => (
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
        </>
      )}

      {sub.returned_books?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>{t('report.returnedBooks')}</Text>
          {sub.returned_books.map((r) => (
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
        </>
      )}

      {sub.ticket_breakdown?.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>{t('report.ticketBreakdown')}</Text>
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

// ---------------------------------------------------------------------------
// PDF HTML builder
// ---------------------------------------------------------------------------

function buildReportHtml(report, t, isRTL) {
  const main = report.main_shift;
  const totals = main.totals || {};
  const subshifts = report.subshifts || [];
  const voidedSubshifts = report.voided_subshifts || [];

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
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
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

  function subshiftHtml(sub) {
    let h = `<div class="card">`;
    h += `<div class="header-row"><h3>${esc(t('report.subshiftTitle', { number: sub.shift_number }))}</h3>${badge(sub.shift_status, sub.voided)}</div>`;
    h += kvRow(t('report.openedBy'), sub.opened_by?.username);
    h += kvRow(t('report.closedBy'), sub.closed_by?.username);
    h += kvRow(t('report.started'), fmtTime(sub.shift_start_time));
    h += kvRow(t('report.ended'), fmtTime(sub.shift_end_time));
    h += `<hr class="divider" />`;
    h += kvRow(t('report.cashInHand'), money(sub.cash_in_hand));
    h += kvRow(t('report.grossSales'), money(sub.gross_sales));
    h += kvRow(t('report.cashOut'), money(sub.cash_out));
    h += kvRow(t('report.ticketsTotal'), money(sub.tickets_total));
    h += kvRow(t('report.expectedCash'), money(sub.expected_cash));
    h += kvRow(t('report.difference'), money(sub.difference), diffCls(sub.shift_status));

    if (sub.books?.length > 0) {
      h += `<hr class="divider" />${sectionLabel(t('report.books'))}`;
      for (const b of sub.books) {
        const meta = `${esc(b.slot_name)} · $${esc(b.ticket_price)} · ${esc(b.open_position)} → ${esc(b.close_position)} · ${esc(t('report.subshiftFooter', { count: b.tickets_sold }))}${b.fully_sold ? ' · ' + esc(t('report.soldOut')) : ''}`;
        h += `<div class="book-row"><div class="book-header"><span>${esc(b.static_code)}</span><span>${money(b.value)}</span></div><div class="book-meta">${meta}</div></div>`;
      }
    }

    if (sub.whole_book_sales?.length > 0) {
      h += `<hr class="divider" />${sectionLabel(t('report.wholeBookSales'))}`;
      for (const s of sub.whole_book_sales) {
        h += `<div class="book-row"><div class="book-header"><span>${esc(s.scanned_barcode)}</span><span>${money(s.value)}</span></div><div class="book-meta">$${esc(s.ticket_price)} · ${esc(s.ticket_count)} · ${esc(s.created_by?.username)}</div></div>`;
      }
    }

    if (sub.returned_books?.length > 0) {
      h += `<hr class="divider" />${sectionLabel(t('report.returnedBooks'))}`;
      for (const r of sub.returned_books) {
        const meta = `${esc(r.slot_name)} · $${esc(r.ticket_price)} · ${esc(r.open_position)} → ${esc(r.returned_at_position)} · ${esc(t('report.soldBeforeReturn', { count: r.tickets_sold }))}`;
        h += `<div class="book-row"><div class="book-header"><span>${esc(r.static_code)}</span><span>${money(r.value)}</span></div><div class="book-meta">${meta}</div></div>`;
      }
    }

    if (sub.ticket_breakdown?.length > 0) {
      h += `<hr class="divider" />${sectionLabel(t('report.ticketBreakdown'))}`;
      for (const bd of sub.ticket_breakdown) {
        h += `<div class="row"><span class="label">$${esc(bd.ticket_price)} · ${esc(bd.source)}</span><span class="value">${esc(bd.tickets_sold)} → ${money(bd.subtotal)}</span></div>`;
      }
    }

    h += `</div>`;
    return h;
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body = '';

  // Main shift header
  body += `<div class="card"><div class="header-row"><h1>${esc(t('report.mainShiftTitle', { id: main.shift_id }))}</h1>${badge(totals.shift_status, main.voided)}</div>${kvRow(t('report.started'), fmtTime(main.shift_start_time))}${kvRow(t('report.ended'), fmtTime(main.shift_end_time))}${kvRow(t('report.openedBy'), main.opened_by?.username)}</div>`;

  // Totals
  body += `<h2>${esc(t('report.totals'))}</h2><div class="card">${kvRow(t('report.ticketsTotal'), money(totals.tickets_total))}${kvRow(t('report.grossSales'), money(totals.gross_sales))}${kvRow(t('report.cashInHand'), money(totals.cash_in_hand))}${kvRow(t('report.expectedCash'), money(totals.expected_cash))}${kvRow(t('report.difference'), money(totals.difference), diffCls(totals.shift_status))}</div>`;

  // Main ticket breakdown
  if (main.ticket_breakdown?.length > 0) {
    body += `<h2>${esc(t('report.ticketBreakdown'))}</h2><div class="card">`;
    for (const bd of main.ticket_breakdown) {
      body += `<div class="row"><span class="label">$${esc(bd.ticket_price)} · ${esc(bd.source)}</span><span class="value">${esc(bd.tickets_sold)} → ${money(bd.subtotal)}</span></div>`;
    }
    body += `</div>`;
  }

  // Sub-shifts
  if (subshifts.length > 0) {
    body += `<h2>${esc(t('report.subshifts'))}</h2>`;
    for (const sub of subshifts) body += subshiftHtml(sub);
  }

  // Voided sub-shifts
  if (voidedSubshifts.length > 0) {
    body += `<h2>${esc(t('report.voidedSubshifts'))}</h2>`;
    for (const sub of voidedSubshifts) {
      body += `<div class="card voided-card"><div class="header-row"><h3>${esc(t('report.subshiftTitle', { number: sub.shift_number }))}</h3>${badge(null, true)}</div>${kvRow(t('report.reason'), sub.void_reason || '—')}</div>`;
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
<title>${esc(t('report.mainShiftTitle', { id: main.shift_id }))}</title>
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
.footer { text-align: center; color: #aaa; font-size: 11px; margin-top: 24px; }
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
