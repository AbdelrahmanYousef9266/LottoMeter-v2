import React, { useState, useCallback, useEffect } from 'react';
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
import { listSlots, createSlot, bulkDeleteSlots } from '../api/slots';
import BulkCreateSlotsModal from '../components/BulkCreateSlotsModal';
import EmptyState from '../components/EmptyState';

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
  const [bulkOpen, setBulkOpen] = useState(false);

  // Selection mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectMode(false);
        setSelectedIds(new Set());
      };
    }, [])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadSlots();
    setRefreshing(false);
  }

  function enterSelectMode() {
    setSelectMode(true);
    setSelectedIds(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(slotId, hasBook) {
    if (hasBook) return; // disabled — slots with books can't be deleted
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
      return next;
    });
  }

  // Auto-exit selection mode when the last item is deselected
  useEffect(() => {
    if (selectMode && selectedIds.size === 0) {
      setSelectMode(false);
    }
  }, [selectMode, selectedIds]);

  function handleLongPress(slot) {
    if (selectMode) return;
    if (!isAdmin) return;
    if (slot.current_book) return; // slots with books aren't selectable
    enterSelectMode();
    toggleSelected(slot.slot_id, false);
  }

  function handleSlotPress(slot) {
    if (selectMode) {
      const hasBook = !!slot.current_book;
      toggleSelected(slot.slot_id, hasBook);
    } else {
      navigation.navigate('SlotDetail', { slotId: slot.slot_id });
    }
  }

  function confirmBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(
      t('books.deleteConfirmTitle', { count }),
      t('books.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('books.deleteSelected', { count }),
          style: 'destructive',
          onPress: handleBulkDelete,
        },
      ]
    );
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setDeleting(true);
    try {
      const result = await bulkDeleteSlots(ids);
      Alert.alert(
        t('books.deleteResultTitle'),
        t('books.deleteResultMessage', {
          deleted: result.deleted_count,
          occupied: result.skipped_occupied?.length || 0,
        })
      );
      exitSelectMode();
      await loadSlots();
    } catch (err) {
      Alert.alert(
        t('books.deleteErrorTitle'),
        err.message || t('common.tryAgain')
      );
    } finally {
      setDeleting(false);
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

  const selectableCount = slots.filter((s) => !s.current_book).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {selectMode ? (
          <>
            <Text style={styles.title}>
              {t('books.selectedCount', { count: selectedIds.size })}
            </Text>
            <TouchableOpacity onPress={exitSelectMode} style={styles.cancelSelectBtn}>
              <Text style={styles.cancelSelectText}>{t('books.cancelSelect')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>{t('books.title')}</Text>
            {isAdmin && (
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  style={styles.bulkButton}
                  onPress={() => setBulkOpen(true)}
                >
                  <Text style={styles.bulkButtonText}>{t('books.bulkAdd')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setCreateOpen(true)}
                >
                  <Text style={styles.addButtonText}>{t('books.newSlot')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {selectMode && (
        <View style={styles.selectionHintBanner}>
          <Text style={styles.selectionHintText}>
            {t('books.selectionHint')}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          selectMode && { paddingBottom: 100 }, // room for action bar
        ]}
        refreshControl={
          !selectMode ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          ) : undefined
        }
      >
        {slots.length === 0 ? (
          <EmptyState
            icon="grid-outline"
            title={t(isAdmin ? 'books.emptyAdminTitle' : 'books.emptyEmployeeTitle')}
            subtitle={t(isAdmin ? 'books.emptyAdminSubtitle' : 'books.emptyEmployeeSubtitle')}
            actionLabel={isAdmin ? t('books.emptyAdminAction') : undefined}
            onAction={isAdmin ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          slots.map((slot) => (
            <SlotCard
              key={slot.slot_id}
              slot={slot}
              t={t}
              selectMode={selectMode}
              selected={selectedIds.has(slot.slot_id)}
              onPress={() => handleSlotPress(slot)}
              onLongPress={() => handleLongPress(slot)}
            />
          ))
        )}
      </ScrollView>

      {/* Floating delete bar in selection mode */}
      {selectMode && selectedIds.size > 0 && (
        <SafeAreaView edges={['bottom']} style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.deleteSelectedBtn, deleting && styles.disabled]}
            onPress={confirmBulkDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteSelectedText}>
                {t('books.deleteSelected', { count: selectedIds.size })}
              </Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      )}

      <CreateSlotModal
        visible={createOpen}
        t={t}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          loadSlots();
        }}
      />

      <BulkCreateSlotsModal
        visible={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onCreated={() => {
          setBulkOpen(false);
          loadSlots();
        }}
      />
    </SafeAreaView>
  );
}

function SlotCard({ slot, t, selectMode, selected, onPress, onLongPress }) {
  const hasBook = !!slot.current_book;
  const disabled = selectMode && hasBook;

  return (
    <TouchableOpacity
      style={[
        styles.slotCard,
        selectMode && styles.slotCardSelectable,
        selected && styles.slotCardSelected,
        disabled && styles.slotCardDisabled,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={styles.slotHeader}>
        <View style={styles.slotHeaderLeft}>
          {selectMode && (
            <View
              style={[
                styles.checkbox,
                selected && styles.checkboxSelected,
                disabled && styles.checkboxDisabled,
              ]}
            >
              {selected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          )}
          <Text style={styles.slotName}>{slot.slot_name}</Text>
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>${slot.ticket_price}</Text>
        </View>
      </View>
      {hasBook ? (
        <View>
          <Text style={styles.slotMeta}>📚 {slot.current_book.static_code}</Text>
          {!selectMode && (
            <Text style={styles.slotSubMeta}>
              {t('books.emptyPositionLabel', {
                position: slot.current_book.start_position,
              })}
              {slot.current_book.book_name
                ? ` · ${slot.current_book.book_name}`
                : ''}
            </Text>
          )}
          {selectMode && (
            <Text style={styles.disabledBadge}>{t('books.hasBookBadge')}</Text>
          )}
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

  headerButtons: { flexDirection: 'row', gap: 6 },
  bulkButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  bulkButtonText: { color: '#1a73e8', fontWeight: '600', fontSize: 13 },

  cancelSelectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelSelectText: { color: '#444', fontWeight: '600' },

  selectionHintBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  selectionHintText: { color: '#92400e', fontSize: 12 },

  scroll: { padding: 16, paddingBottom: 32 },

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
  slotCardSelectable: {
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  slotCardSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#e8f0fe',
  },
  slotCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },

  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    borderColor: '#1a73e8',
    backgroundColor: '#1a73e8',
  },
  checkboxDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#eee',
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },

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
  disabledBadge: { fontSize: 12, color: '#999', marginTop: 2, fontStyle: 'italic' },

  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 6,
    elevation: 8,
  },
  deleteSelectedBtn: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteSelectedText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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