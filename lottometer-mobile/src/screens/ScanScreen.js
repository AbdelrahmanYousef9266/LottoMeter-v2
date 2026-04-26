import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { getCurrentOpenShift } from '../api/shifts';
import { recordScan } from '../api/scan';

export default function ScanScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [openSubId, setOpenSubId] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const [barcode, setBarcode] = useState('');
  const [scanType, setScanType] = useState('open');
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [scanCount, setScanCount] = useState(0);
// Auto-switch scan_type based on sub-shift initialization state:
  //   - Not initialized → force "open" (employee is opening books)
  //   - Initialized     → force "close" (employee is recording sales)
  useEffect(() => {
    setScanType(isInitialized ? 'close' : 'open');
  }, [isInitialized]);

  const inputRef = useRef(null);

  const loadShift = useCallback(async () => {
    try {
      const detail = await getCurrentOpenShift();
      if (!detail) {
        setShift(null);
        setOpenSubId(null);
        return;
      }
      setShift(detail);
      const openSub = detail.subshifts.find((s) => s.is_shift_open);
      setOpenSubId(openSub?.shift_id || null);

      const pending = detail.current_subshift_pending;
      if (pending) {
        setPendingCount(pending.pending_scans?.length || 0);
        setIsInitialized(!!pending.is_initialized);
      } else {
        setPendingCount(0);
        setIsInitialized(true);
      }
    } catch (err) {
      Alert.alert('Error loading shift', err.message || 'Try again.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadShift().finally(() => setLoading(false));
    }, [loadShift])
  );

  // Submits a scan with the given barcode (used by both manual + camera)
  const submitScan = useCallback(
    async (rawBarcode) => {
      const code = (rawBarcode || '').trim();
      if (!code || code.length < 4) {
        Alert.alert('Invalid barcode', 'Enter at least 4 characters.');
        return;
      }
      if (!openSubId) {
        Alert.alert('No open shift', 'Open a shift on the Home tab first.');
        return;
      }

      setBusy(true);
      try {
        const result = await recordScan({
          shift_id: openSubId,
          barcode: code,
          scan_type: scanType,
        });
      setLastScan({
          scan: result.scan,
          book: result.book,
          running_totals: result.running_totals,
          pending_scans_remaining: result.pending_scans_remaining,
          is_initialized: result.is_initialized,
        });
        setScanCount((c) => c + 1);
        setPendingCount(result.pending_scans_remaining);
        setIsInitialized(result.is_initialized);
        setBarcode('');
        setTimeout(() => inputRef.current?.focus(), 50);
      } catch (err) {
        Alert.alert(
          err.code || 'Scan failed',
          err.message || 'Could not record scan.'
        );
      } finally {
        setBusy(false);
      }
    },
    [openSubId, scanType]
  );

  function handleManualScan() {
    submitScan(barcode);
  }

  function handleOpenCamera() {
    if (!openSubId) {
      Alert.alert('No open shift', 'Open a shift on the Home tab first.');
      return;
    }
    navigation.navigate('CameraScanner', {
      onScanned: (data) => {
        submitScan(data);
      },
    });
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

  if (!shift || !openSubId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Scan</Text>
          <Text style={styles.subtitle}>No open shift.</Text>
          <Text style={styles.subtitle}>
            Open a shift on the Home tab to start scanning.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Scan</Text>

          {!isInitialized ? (
            <View style={[styles.banner, styles.bannerWarn]}>
              <Text style={styles.bannerText}>
                ⚠ Sub-shift not initialized — {pendingCount} book(s) need open scans.
              </Text>
            </View>
          ) : (
            <View style={[styles.banner, styles.bannerOk]}>
              <Text style={styles.bannerText}>
                ✓ Sub-shift initialized. Ready for sales / close scans.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            {/* Scan type picker first */}
            <Text style={styles.label}>Scan Type</Text>
          <View style={styles.pickerRow}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  scanType === 'open' && styles.pickerOptionActive,
                  isInitialized && styles.pickerOptionDisabled,
                ]}
                onPress={() => !isInitialized && setScanType('open')}
                disabled={isInitialized}
              >
                <Text
                  style={[
                    styles.pickerText,
                    scanType === 'open' && styles.pickerTextActive,
                    isInitialized && styles.pickerTextDisabled,
                  ]}
                >
                  Open
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  scanType === 'close' && styles.pickerOptionActive,
                  !isInitialized && styles.pickerOptionDisabled,
                ]}
                onPress={() => isInitialized && setScanType('close')}
                disabled={!isInitialized}
              >
                <Text
                  style={[
                    styles.pickerText,
                    scanType === 'close' && styles.pickerTextActive,
                    !isInitialized && styles.pickerTextDisabled,
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            {/* Camera scan button */}
            <TouchableOpacity
              style={[styles.cameraButton, busy && styles.disabled]}
              onPress={handleOpenCamera}
              disabled={busy}
            >
              <Text style={styles.cameraButtonText}>📷  Scan with Camera</Text>
            </TouchableOpacity>

            <Text style={styles.divider}>— or enter manually —</Text>

            <Text style={styles.label}>Barcode</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Type or paste barcode"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={handleManualScan}
            />

            <TouchableOpacity
              style={[styles.scanButton, busy && styles.disabled]}
              onPress={handleManualScan}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.scanButtonText}>Submit Scan</Text>
              )}
            </TouchableOpacity>
          </View>

          {lastScan && (
            <View
              style={[
                styles.card,
                styles.lastScanCard,
                lastScan.scan?.is_last_ticket && styles.lastTicketCard,
              ]}
            >
              <Text style={styles.lastScanTitle}>
                {lastScan.scan?.is_last_ticket
                  ? '🎯 Last Ticket — Book Sold'
                  : '✓ Scan Recorded'}
              </Text>
              <KV k="Type" v={lastScan.scan?.scan_type} />
              <KV k="Position" v={lastScan.scan?.start_at_scan} />
              <KV k="Book" v={lastScan.book?.static_code} />
              <KV k="Price" v={lastScan.book?.ticket_price} />
              <KV k="Source" v={lastScan.scan?.scan_source} />
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Scans this session: {scanCount}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 4 },

  banner: { borderRadius: 8, padding: 12, marginBottom: 12 },
  bannerWarn: { backgroundColor: '#fef3c7' },
  bannerOk: { backgroundColor: '#dcfce7' },
  bannerText: { fontSize: 13, color: '#222' },

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
  label: {
    fontSize: 13,
    color: '#444',
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },

  pickerRow: { flexDirection: 'row', gap: 8 },
  pickerOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
 pickerOptionActive: {
    borderColor: '#1a73e8',
    backgroundColor: '#e8f0fe',
  },
  pickerOptionDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#eee',
    opacity: 0.5,
  },
  pickerText: { color: '#666', fontWeight: '600' },
  pickerTextActive: { color: '#1a73e8' },
  pickerTextDisabled: { color: '#aaa' },

  cameraButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  cameraButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  divider: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginVertical: 12,
  },

  scanButton: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },

  lastScanCard: { borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  lastTicketCard: { borderLeftColor: '#dc2626', backgroundColor: '#fef2f2' },
  lastScanTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvKey: { color: '#666', fontSize: 13 },
  kvValue: { color: '#222', fontSize: 13, fontWeight: '600' },

  footer: { alignItems: 'center', marginTop: 8 },
  footerText: { color: '#888', fontSize: 12 },
});