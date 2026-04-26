import React, { useState, useCallback } from 'react';
import ReturnBookModal from '../components/ReturnBookModal';
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { getSlot, assignBook, unassignBook } from '../api/slots';

export default function SlotDetailScreen({ route }) {
  const { slotId } = route.params;
  const navigation = useNavigation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [returnOpen, setReturnOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const loadSlot = useCallback(async () => {
    try {
      const data = await getSlot(slotId);
      setSlot(data);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load slot.');
    }
  }, [slotId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSlot().finally(() => setLoading(false));
    }, [loadSlot])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadSlot();
    setRefreshing(false);
  }

  function handleScanToAssign() {
    navigation.navigate('CameraScanner', {
      onScanned: async (barcode) => {
        await doAssign(barcode);
      },
    });
  }

  async function doAssign(barcode, confirmReassign = false) {
    setBusy(true);
    try {
      await assignBook(slotId, {
        barcode,
        confirm_reassign: confirmReassign,
      });
      await loadSlot();
    } catch (err) {
      if (err.code === 'REASSIGN_CONFIRMATION_REQUIRED') {
        Alert.alert(
          'Book is in another slot',
          'This book is currently active in a different slot. Move it to this slot?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Move it',
              style: 'destructive',
              onPress: () => doAssign(barcode, true),
            },
          ]
        );
      } else {
        Alert.alert(err.code || 'Could not assign', err.message || 'Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  function handleManualAssign() {
    setManualOpen(true);
  }

  async function submitManual() {
    const code = manualBarcode.trim();
    if (!code || code.length < 4) {
      Alert.alert('Invalid barcode', 'Enter at least 4 characters.');
      return;
    }
    setManualOpen(false);
    setManualBarcode('');
    await doAssign(code);
  }

  function confirmUnassign() {
    if (!slot?.current_book) return;
    Alert.alert(
      'Unassign book?',
      `Remove "${slot.current_book.static_code}" from this slot?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: handleUnassign,
        },
      ]
    );
  }

  async function handleUnassign() {
    if (!slot?.current_book) return;
    setBusy(true);
    try {
      await unassignBook(slot.current_book.book_id);
      await loadSlot();
    } catch (err) {
      Alert.alert(err.code || 'Could not unassign', err.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleReturnSuccess(result) {
    setReturnOpen(false);
    Alert.alert(
      'Book returned',
      result.close_scan_recorded
        ? `Pre-return revenue preserved at position ${result.position}.`
        : 'Book unassigned and marked returned.'
    );
    loadSlot();
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

  if (!slot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Slot not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasBook = !!slot.current_book;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Slots</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.card}>
          <View style={styles.slotHeader}>
            <Text style={styles.slotName}>{slot.slot_name}</Text>
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>${slot.ticket_price}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {hasBook ? 'Current Book' : 'Slot Empty'}
          </Text>

          {hasBook ? (
            <>
              <KV k="Static Code" v={slot.current_book.static_code} />
              <KV k="Start Position" v={slot.current_book.start_position} />
              <KV k="Book Name" v={slot.current_book.book_name || '—'} />
            </>
          ) : (
            <Text style={styles.emptyText}>
              No book assigned. Scan or type a barcode to assign one.
            </Text>
          )}
        </View>

        <View style={styles.actionsCard}>
          {/* Admin-only: assign and unassign */}
          {isAdmin && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryAction, busy && styles.disabled]}
                onPress={handleScanToAssign}
                disabled={busy}
              >
                <Text style={styles.actionButtonText}>
                  📷  {hasBook ? 'Replace Book (Scan)' : 'Assign Book (Scan)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryAction, busy && styles.disabled]}
                onPress={handleManualAssign}
                disabled={busy}
              >
                <Text style={styles.secondaryActionText}>
                  ⌨  {hasBook ? 'Replace Book (Manual)' : 'Assign Book (Manual)'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Available to any user when a book is present: Return */}
          {hasBook && (
            <TouchableOpacity
              style={[styles.actionButton, styles.warningAction, busy && styles.disabled]}
              onPress={() => setReturnOpen(true)}
              disabled={busy}
            >
              <Text style={styles.warningActionText}>↩️  Return to Vendor</Text>
            </TouchableOpacity>
          )}

          {/* Admin-only: unassign */}
          {isAdmin && hasBook && (
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerAction, busy && styles.disabled]}
              onPress={confirmUnassign}
              disabled={busy}
            >
              <Text style={styles.dangerActionText}>Unassign Book</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isAdmin && !hasBook && (
          <Text style={styles.adminHint}>
            Slot management is admin-only.
          </Text>
        )}
      </ScrollView>

      <Modal
        visible={manualOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManualOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter Barcode</Text>
            <Text style={styles.modalHint}>
              Type the full barcode including the 3-digit position at the end.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder="e.g. 1234567890000"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="done"
              onSubmitEditing={submitManual}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => {
                  setManualOpen(false);
                  setManualBarcode('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirm]}
                onPress={submitManual}
              >
                <Text style={styles.modalConfirmText}>Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        <ReturnBookModal
        visible={returnOpen}
        bookId={slot?.current_book?.book_id}
        prefilledStaticCode={slot?.current_book?.static_code}
        onCancel={() => setReturnOpen(false)}
        onSuccess={handleReturnSuccess}
      />
      </Modal>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { padding: 16 },
  backText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },

  scroll: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotName: { fontSize: 24, fontWeight: '700', color: '#222' },
  priceBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priceBadgeText: { color: '#1a73e8', fontWeight: '600' },

  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  emptyText: { color: '#666', fontSize: 14 },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  kvKey: { color: '#666', fontSize: 14 },
  kvValue: { color: '#222', fontSize: 14, fontWeight: '600' },

  actionsCard: { marginTop: 4 },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryAction: { backgroundColor: '#16a34a' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryAction: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  secondaryActionText: { color: '#1a73e8', fontSize: 16, fontWeight: '600' },
  dangerAction: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  dangerActionText: { color: '#dc3545', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  warningAction: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d97706',
  },
  warningActionText: { color: '#d97706', fontSize: 16, fontWeight: '600' },
  adminHint: {
    textAlign: 'center',
    color: '#888',
    fontSize: 13,
    marginTop: 12,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  modalHint: { fontSize: 13, color: '#666', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancel: { backgroundColor: '#f0f0f0' },
  modalCancelText: { color: '#444', fontWeight: '600' },
  modalConfirm: { backgroundColor: '#1a73e8' },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
});