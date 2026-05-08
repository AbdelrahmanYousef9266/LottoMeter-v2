import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { listSlots } from '../api/slots';
import { LENGTH_BY_PRICE, lastPositionFor, parseBarcode } from '../utils/bookConstants';
import { normalizeBarcode } from '../utils/barcodeUtils';

const ERROR_OVERLAY_MS = 1500;

export default function CameraScannerScreen({ navigation, route }) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();

  const onScanned = route.params?.onScanned;
  const mode = route.params?.mode === 'continuous' ? 'continuous' : 'single';
  // route param 'validate' (default true): when true, we check static_code + position
  // against the active books list. Set to false for slot assignment flows where
  // the scanner needs to accept barcodes for books that don't yet exist.
  const validate = route.params?.validate !== false;

  const lockRef = useRef(false);
  const scannedSetRef = useRef(new Set());

  const [scanCount, setScanCount] = useState(0);
  const [lastScannedDisplay, setLastScannedDisplay] = useState(null);
  const [singleScanned, setSingleScanned] = useState(false);

  // Active books lookup: static_code -> { book_id, ticket_price, book_length }
  const [bookMap, setBookMap] = useState(null);
  const [bookMapLoading, setBookMapLoading] = useState(true);

  // Error state shown briefly when a scan is rejected
  const [errorMessage, setErrorMessage] = useState(null);
  const errorTimerRef = useRef(null);

  useEffect(() => {
    if (!validate) {
      setBookMap(new Map());
      setBookMapLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await listSlots();
        const map = new Map();
        (data.slots || []).forEach((slot) => {
          const book = slot.current_book;
          if (book) {
            map.set(book.static_code, {
              book_id: book.book_id,
              ticket_price: slot.ticket_price,
              book_length: LENGTH_BY_PRICE[slot.ticket_price] ?? null,
            });
          }
        });
        setBookMap(map);
      } catch (_err) {
        setBookMap(new Map());
      } finally {
        setBookMapLoading(false);
      }
    })();
  }, [validate]);

  const flashError = useCallback((message) => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    setErrorMessage(message);
    Vibration.vibrate([0, 80, 80, 80]); // short-pause-short pattern
    errorTimerRef.current = setTimeout(() => {
      setErrorMessage(null);
      errorTimerRef.current = null;
    }, ERROR_OVERLAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const handleBarCodeScanned = useCallback(
    ({ data }) => {
      const normalized = normalizeBarcode(data);

      // Layer 1 + 2: client-side validation against the active books list.
      // We only do this if `validate` is true and the books map has loaded.
      if (validate && bookMap) {
        const parsed = parseBarcode(normalized);
        if (!parsed) {
          flashError(t('camera.errorMalformed'));
          return;
        }

        const book = bookMap.get(parsed.static_code);
        if (!book) {
          // Don't reveal which static code: just say it's unknown.
          flashError(t('camera.errorUnknownBook'));
          return;
        }

        const lastPos = book.book_length !== null ? book.book_length - 1 : null;
        if (
          parsed.position < 0 ||
          (lastPos !== null && parsed.position > lastPos)
        ) {
          flashError(
            t('camera.errorBadPosition', {
              position: parsed.position,
              max: lastPos,
              price: book.ticket_price,
            })
          );
          return;
        }
      }

      if (mode === 'single') {
        if (lockRef.current) return;
        lockRef.current = true;
        setSingleScanned(true);
        Vibration.vibrate(60);
        if (typeof onScanned === 'function') {
          onScanned(normalized);
        }
        navigation.goBack();
        return;
      }

      // Continuous mode: each unique barcode is scanned at most once per session.
      if (scannedSetRef.current.has(normalized)) {
        return;
      }
      scannedSetRef.current.add(normalized);

      Vibration.vibrate(40);
      setScanCount((n) => n + 1);
      setLastScannedDisplay(normalized);
      if (typeof onScanned === 'function') {
        onScanned(normalized);
      }
    },
    [mode, onScanned, navigation, validate, bookMap, flashError, t]
  );

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.permTitle}>{t('camera.permissionRequired')}</Text>
          <Text style={styles.permText}>{t('camera.permissionHint')}</Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.permButtonText}>{t('camera.grantPermission')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.permButton, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>{t('camera.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const scannerEnabled =
    !bookMapLoading && (mode === 'continuous' || !singleScanned);

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scannerEnabled ? handleBarCodeScanned : undefined}
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

      <View style={styles.overlay}>
        <View style={styles.targetBox} />
        <Text style={styles.hint}>
          {bookMapLoading
            ? t('camera.loading')
            : mode === 'continuous'
            ? t('camera.continuousHint')
            : t('camera.hint')}
        </Text>
      </View>

      {errorMessage && (
        <View pointerEvents="none" style={styles.errorOverlayBackdrop} />
      )}

      <SafeAreaView style={styles.statusOverlay} edges={['top']}>
        {errorMessage ? (
          <View style={styles.errorPill}>
            <Text style={styles.errorPillText}>{errorMessage}</Text>
          </View>
        ) : (
          mode === 'continuous' && (
            <View style={styles.statusBox}>
              <Text style={styles.statusCount}>
                {t('camera.scannedCount', { count: scanCount })}
              </Text>
              {lastScannedDisplay && (
                <Text style={styles.statusLast} numberOfLines={1}>
                  ✓ {lastScannedDisplay}
                </Text>
              )}
            </View>
          )
        )}
      </SafeAreaView>

      <SafeAreaView style={styles.bottom} edges={['bottom']}>
        <TouchableOpacity
          style={mode === 'continuous' ? styles.doneBtn : styles.cancelBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneBtnText}>
            {mode === 'continuous' ? t('camera.done') : t('camera.cancel')}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  permTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  permText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  permButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  permButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: '#333' },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetBox: {
    width: 280,
    height: 160,
    borderWidth: 3,
    borderColor: '#1a73e8',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusBox: {
    marginTop: 12,
    backgroundColor: 'rgba(22, 163, 74, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 180,
    alignItems: 'center',
  },
  statusCount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusLast: { color: '#dcfce7', fontSize: 12, marginTop: 2, maxWidth: 240 },

  errorOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(220, 38, 38, 0.18)',
  },
  errorPill: {
    marginTop: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: 320,
  },
  errorPillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  doneBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});