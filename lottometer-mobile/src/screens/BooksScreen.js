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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { listSlots, createSlot } from '../api/slots';

const VALID_PRICES = ['1.00', '2.00', '3.00', '5.00', '10.00', '20.00'];

export default function BooksScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);

  const loadSlots = useCallback(async () => {
    try {
      const data = await listSlots();
      setSlots(data.slots || []);
    } catch (err) {
      Alert.alert(t('books.errorLoadingSlots'), err.message || t('common.tryAgain'));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSlots().finally(() => setLoading(false));
    }, [loadSlots])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadSlots();
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('books.title')}</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.addButton} onPress={() => setCreateOpen(true)}>
            <Text style={styles.addButtonText}>{t('books.newSlot')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {slots.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('books.noSlots')}</Text>
            {isAdmin && <Text style={styles.emptyHint}>{t('books.noSlotsHint')}</Text>}
          </View>
        ) : (
          slots.map((slot) => (
            <SlotCard
              key={slot.slot_id}
              slot={slot}
              t={t}
              onPress={() =>
                navigation.navigate('SlotDetail', { slotId: slot.slot_id })
              }
            />
          ))
        )}
      </ScrollView>

      <CreateSlotModal
        visible={createOpen}
        t={t}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          loadSlots();
        }}
      />
    </SafeAreaView>
  );
}

function SlotCard({ slot, t, onPress }) {
  const hasBook = !!slot.current_book;
  return (
    <TouchableOpacity style={styles.slotCard} onPress={onPress}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotName}>{slot.slot_name}</Text>
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>${slot.ticket_price}</Text>
        </View>
      </View>
      {hasBook ? (
        <View>
          <Text style={styles.slotMeta}>
            📚 {slot.current_book.static_code}
          </Text>
          <Text style={styles.slotSubMeta}>
            {t('books.emptyPositionLabel', { position: slot.current_book.start_position })}
            {slot.current_book.book_name ? ` · ${slot.current_book.book_name}` : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.slotEmpty}>{t('books.emptySlotHint')}</Text>
      )}
    </TouchableOpacity>
  );
}

function CreateSlotModal({ visible, t, onClose, onCreated }) {
  const [slotName, setSlotName] = useState('');
  const [price, setPrice] = useState('5.00');
  const [busy, setBusy] = useState(false);

  function reset() {
    setSlotName('');
    setPrice('5.00');
  }

  async function handleCreate() {
    if (!slotName.trim()) {
      Alert.alert(t('books.missingName'), t('books.missingNameHint'));
      return;
    }
    setBusy(true);
    try {
      await createSlot({ slot_name: slotName.trim(), ticket_price: price });
      reset();
      onCreated();
    } catch (err) {
      Alert.alert(err.code || t('common.error'), err.message || t('books.couldNotCreate'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('books.newSlotTitle')}</Text>

          <Text style={styles.label}>{t('books.slotName')}</Text>
          <TextInput
            style={styles.input}
            value={slotName}
            onChangeText={setSlotName}
            placeholder={t('books.slotNamePlaceholder')}
            autoFocus
          />

          <Text style={styles.label}>{t('books.ticketPrice')}</Text>
          <View style={styles.priceGrid}>
            {VALID_PRICES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.priceOption, price === p && styles.priceOptionActive]}
                onPress={() => setPrice(p)}
              >
                <Text
                  style={[
                    styles.priceOptionText,
                    price === p && styles.priceOptionTextActive,
                  ]}
                >
                  ${p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirm, busy && styles.disabled]}
              onPress={handleCreate}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalConfirmText}>{t('books.create')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '700' },
  addButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },

  scroll: { padding: 16, paddingBottom: 32 },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 4 },
  emptyHint: { fontSize: 13, color: '#888' },

  slotCard: {
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
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotName: { fontSize: 18, fontWeight: '700', color: '#222' },
  priceBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  priceBadgeText: { color: '#1a73e8', fontWeight: '600' },

  slotMeta: { fontSize: 14, color: '#222', fontWeight: '600' },
  slotSubMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  slotEmpty: { fontSize: 13, color: '#888', fontStyle: 'italic' },

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
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
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
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  priceOptionActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  priceOptionText: { color: '#666', fontWeight: '600' },
  priceOptionTextActive: { color: '#1a73e8' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
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
  disabled: { opacity: 0.6 },
});