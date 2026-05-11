import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { listSlots, assignBook } from '../api/slots';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { friendlyScanError } from '../utils/scanErrorMessages';
import { normalizeBarcode } from '../utils/barcodeUtils';

export default function BulkAssignScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { scanMode } = useAuth();
  const fireFeedback = useFeedback();

  // Camera mode for any camera-based scan_mode; hardware_scanner users keep text input.
  const useCamera = scanMode !== 'hardware_scanner';
  const [permission, requestPermission] = useCameraPermissions();

  const [currentSlot, setCurrentSlot] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignedCount, setAssignedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [skippedSlotIds, setSkippedSlotIds] = useState(new Set());
  const [allDone, setAllDone] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastAssigned, setLastAssigned] = useState(null);

  const inputRef = useRef(null);
  const lastScanRef = useRef({ barcode: null, timestamp: 0 });
  // Ref mirrors `busy` state so reassign-confirm callbacks always see current value,
  // avoiding stale-closure false-positives on the `if (busy) return` guard.
  const busyRef = useRef(false);

  function setBusyBoth(val) {
    busyRef.current = val;
    setBusy(val);
  }

  useEffect(() => {
    loadFirstEmptySlot();
  }, []);

  const loadFirstEmptySlot = useCallback(async () => {
    try {
      const data = await listSlots();
      const slots = data.slots || data;
      const empty = slots.find((s) => !s.current_book && !s.deleted_at);
      if (empty) {
        setCurrentSlot(empty);
        if (!useCamera) setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setAllDone(true);
      }
    } catch (err) {
      Alert.alert(t('bulkAssign.loadFailedTitle'), t('bulkAssign.loadFailedBody'));
    } finally {
      setInitialLoading(false);
    }
  }, [t, useCamera]);

  // barcodeArg: explicit code (from camera or auto-submit path); falls back to
  // the `barcode` state when null/undefined.
  const handleSubmit = useCallback(
    async (barcodeArg, confirmReassign = false) => {
      const normalized = normalizeBarcode(barcodeArg ?? barcode);

      if (normalized.length !== 13) return;
      if (busyRef.current) return;

      const now = Date.now();
      if (lastScanRef.current.barcode === normalized && now - lastScanRef.current.timestamp < 2000) {
        setBarcode('');
        return;
      }
      lastScanRef.current = { barcode: normalized, timestamp: now };

      setBusyBoth(true);
      const slotName = currentSlot?.slot_name;
      try {
        const result = await assignBook(currentSlot.slot_id, {
          barcode: normalized,
          confirm_reassign: confirmReassign,
        });

        fireFeedback('success');
        setAssignedCount((c) => c + 1);
        setLastAssigned(slotName);
        setTimeout(() => setLastAssigned(null), 1500);
        setBarcode('');

        if (result.next_empty_slot) {
          setCurrentSlot(result.next_empty_slot);
          if (!useCamera) setTimeout(() => inputRef.current?.focus(), 100);
        } else {
          setAllDone(true);
        }
      } catch (err) {
        if (err.code === 'REASSIGN_CONFIRMATION_REQUIRED') {
          fireFeedback('error');
          Alert.alert(
            t('slotDetail.reassignTitle'),
            t('slotDetail.reassignMessage'),
            [
              {
                text: t('common.cancel'),
                style: 'cancel',
                onPress: () => {
                  if (!useCamera) {
                    setBarcode('');
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }
                },
              },
              {
                text: t('slotDetail.reassignMove'),
                // Pass normalized explicitly so the confirm call doesn't rely on stale state.
                onPress: () => handleSubmit(normalized, true),
              },
            ]
          );
        } else {
          fireFeedback('error');
          Alert.alert(t('scan.scanFailed'), friendlyScanError(err, t));
          setBarcode('');
          if (!useCamera) setTimeout(() => inputRef.current?.focus(), 100);
        }
      } finally {
        setBusyBoth(false);
      }
    },
    [barcode, currentSlot, fireFeedback, t, useCamera]
  );

  const handleBarCodeScanned = useCallback(
    ({ data }) => {
      const normalized = normalizeBarcode(data);
      if (normalized.length === 13) handleSubmit(normalized);
    },
    [handleSubmit]
  );

  const handleSkip = useCallback(async () => {
    if (busyRef.current) return;
    setBusyBoth(true);
    try {
      // Mark current slot as skipped
      const newSkipped = new Set(skippedSlotIds);
      if (currentSlot) {
        newSkipped.add(currentSlot.slot_id);
        setSkippedSlotIds(newSkipped);
      }

      const data = await listSlots();
      const slots = data.slots || data;
      const sorted = [...slots].sort((a, b) => {
        const numA = parseInt(a.slot_name, 10) || 0;
        const numB = parseInt(b.slot_name, 10) || 0;
        return numA - numB;
      });

      // Next empty slot that hasn't been visited yet
      const nextSlot = sorted.find(
        (s) =>
          !s.current_book &&
          !s.deleted_at &&
          s.slot_id !== currentSlot?.slot_id &&
          !newSkipped.has(s.slot_id)
      );

      if (nextSlot) {
        setCurrentSlot(nextSlot);
        setBarcode('');
        setSkippedCount((c) => c + 1);
        if (!useCamera) setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        // No unvisited empty slots — check if skipped slots still need books
        const skippedRemaining = sorted.filter(
          (s) => !s.current_book && !s.deleted_at && newSkipped.has(s.slot_id)
        );

        if (skippedRemaining.length > 0) {
          Alert.alert(
            'Skipped Slots',
            `You have ${skippedRemaining.length} skipped slot(s). Go back to assign them?`,
            [
              {
                text: 'Skip All',
                style: 'cancel',
                onPress: () => setAllDone(true),
              },
              {
                text: 'Go Back',
                onPress: () => {
                  setSkippedSlotIds(new Set());
                  setCurrentSlot(skippedRemaining[0]);
                  setBarcode('');
                  if (!useCamera) setTimeout(() => inputRef.current?.focus(), 100);
                },
              },
            ]
          );
        } else {
          setAllDone(true);
        }
      }
    } catch (err) {
      Alert.alert(t('bulkAssign.loadFailedTitle'), t('bulkAssign.loadFailedBody'));
    } finally {
      setBusyBoth(false);
    }
  }, [currentSlot, skippedSlotIds, t, useCamera]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Camera permission (only relevant when useCamera is true) ─────────────────

  if (useCamera && !permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      </SafeAreaView>
    );
  }

  if (useCamera && !permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.permContainer]}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={64} color="#9aa0a6" style={{ marginBottom: 16 }} />
          <Text style={styles.permTitle}>{t('camera.permissionRequired')}</Text>
          <Text style={styles.permText}>{t('camera.permissionHint')}</Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.permButtonText}>{t('camera.grantPermission')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
            <Text style={styles.exitButtonText}>{t('bulkAssign.exitEarly')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── All done ─────────────────────────────────────────────────────────────────

  if (allDone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.completionWrap}>
          <View style={styles.completionIcon}>
            <Ionicons name="checkmark-circle" size={96} color="#1a73e8" />
          </View>
          <Text style={styles.completionTitle}>{t('bulkAssign.allDoneTitle')}</Text>
          <Text style={styles.completionBody}>
            {t('bulkAssign.allDoneBody', { count: assignedCount })}
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('bulkAssign.title')}</Text>
          <Text style={styles.counter}>
            {t('bulkAssign.assigned', { count: assignedCount })}
            {skippedCount > 0 ? `  ·  ${t('bulkAssign.skipped', { count: skippedCount })}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.slotCard}>
        <Text style={styles.slotLabel}>{t('bulkAssign.currentSlot')}</Text>
        <Text style={styles.slotName}>{currentSlot.slot_name}</Text>
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>${currentSlot.ticket_price}</Text>
        </View>
      </View>

      {lastAssigned && (
        <View style={styles.successToast}>
          <Text style={styles.successToastText}>✓ {t('bulkAssign.assignedTo', { slot: lastAssigned })}</Text>
        </View>
      )}

      {useCamera ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={busy ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code39',
                'code93',
                'code128',
                'codabar',
                'itf14',
                'pdf417',
                'qr',
              ],
            }}
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.targetBox} />
            <Text style={styles.cameraHint}>{t('bulkAssign.cameraHint')}</Text>
          </View>
          {busy && (
            <View style={styles.cameraBusyOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>{t('bulkAssign.scanBarcodeLabel')}</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={barcode}
            onChangeText={(text) => {
              const normalized = normalizeBarcode(text);
              setBarcode(normalized);
              if (normalized.length === 13) handleSubmit(normalized);
            }}
            placeholder={t('bulkAssign.barcodePlaceholder')}
            placeholderTextColor="#aaa"
            keyboardType="numeric"
            maxLength={14}
            autoFocus
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={() => handleSubmit(null)}
          />
          <TouchableOpacity
            style={[styles.skipButton, busy && styles.submitButtonDisabled]}
            onPress={handleSkip}
            disabled={busy}
          >
            <Text style={styles.skipButtonText}>{t('bulkAssign.skipSlot')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {useCamera && (
        <TouchableOpacity
          style={[styles.skipButton, styles.skipButtonCamera, busy && styles.submitButtonDisabled]}
          onPress={handleSkip}
          disabled={busy}
        >
          <Text style={styles.skipButtonText}>{t('bulkAssign.skipSlot')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
        <Text style={styles.exitButtonText}>{t('bulkAssign.exitEarly')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permContainer: { backgroundColor: '#f4f5f7' },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#202124' },
  counter: { fontSize: 13, color: '#5f6368', marginTop: 2 },

  slotCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  slotLabel: { fontSize: 13, color: '#5f6368', marginBottom: 8 },
  slotName: { fontSize: 28, fontWeight: '700', color: '#202124', marginBottom: 8 },
  priceBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priceBadgeText: { color: '#1a73e8', fontWeight: '600' },

  // Camera mode
  cameraWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBox: {
    width: 260,
    height: 140,
    borderWidth: 2.5,
    borderColor: '#1a73e8',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  cameraHint: {
    color: '#fff',
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cameraBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Text-input mode
  inputCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  successToast: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
  },
  successToastText: { color: '#16A34A', fontWeight: '600', fontSize: 14 },

  inputLabel: { fontSize: 13, color: '#5f6368', fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    backgroundColor: '#fafafa',
    marginBottom: 8,
    color: '#202124',
  },
  submitButtonDisabled: { opacity: 0.4 },

  skipButton: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  skipButtonCamera: { marginTop: 8 },
  skipButtonText: { color: '#5f6368', fontSize: 15, fontWeight: '600' },

  exitButton: { padding: 20, alignItems: 'center', marginTop: 8 },
  exitButtonText: { color: '#5f6368', fontSize: 14 },

  // Permission UI
  permTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
    textAlign: 'center',
  },
  permText: {
    fontSize: 14,
    color: '#5f6368',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  permButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Completion screen
  completionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  completionIcon: { marginBottom: 16 },
  completionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202124',
    textAlign: 'center',
    marginBottom: 8,
  },
  completionBody: {
    fontSize: 14,
    color: '#5f6368',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
