import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { listSlots, createSlot, bulkDeleteSlots } from '../api/slots';
import { getBooksSummary } from '../api/books';
import ActionPopupMenu from '../components/ActionPopupMenu';
import BulkCreateSlotsModal from '../components/BulkCreateSlotsModal';

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
const FS = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 28 };
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

const VALID_PRICES = ['1.00', '2.00', '3.00', '5.00', '10.00', '20.00'];

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

// ── screen ─────────────────────────────────────────────────────────────────────

export default function BooksScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation();
  const isAdmin = user?.role === 'admin';

  // ── existing state ─────────────────────────────────────────────────────────
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots]         = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting]   = useState(false);

  // ── stats state ────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState(null);

  // ── existing callbacks (unchanged) ─────────────────────────────────────────

  const loadSlots = useCallback(async () => {
    try {
      const data = await listSlots();
      setSlots(data.slots || []);
    } catch (err) {
      Alert.alert(t('books.errorLoadingSlots'), err.message || t('common.tryAgain'));
    }
  }, [t]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getBooksSummary();
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([loadSlots(), loadSummary()]).finally(() => setLoading(false));
    }, [loadSlots, loadSummary])
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
    await Promise.all([loadSlots(), loadSummary()]);
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
    if (hasBook) return;
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

  useEffect(() => {
    if (selectMode && selectedIds.size === 0) {
      setSelectMode(false);
    }
  }, [selectMode, selectedIds]);

  function handleLongPress(slot) {
    if (selectMode) return;
    if (!isAdmin) return;
    if (slot.current_book) return;
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
      Alert.alert(t('books.deleteErrorTitle'), err.message || t('common.tryAgain'));
    } finally {
      setDeleting(false);
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const emptySlotCount = slots.filter((s) => !s.current_book).length;

  // ── loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('books.title')}</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safeArea}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        {selectMode ? (
          <>
            <Text style={s.headerTitle}>
              {t('books.selectedCount', { count: selectedIds.size })}
            </Text>
            <TouchableOpacity style={s.cancelSelectBtn} onPress={exitSelectMode}>
              <Text style={s.cancelSelectText}>{t('books.cancelSelect')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.headerTitle}>{t('books.title')}</Text>
            {isAdmin && (
              <>
                <TouchableOpacity
                  style={s.headerAddBtn}
                  onPress={() => setMenuOpen(true)}
                >
                  <Ionicons name="add" size={22} color={D.PRIMARY} />
                </TouchableOpacity>
                <ActionPopupMenu
                  visible={menuOpen}
                  onClose={() => setMenuOpen(false)}
                  actions={[
                    {
                      label: t('books.addSlot'),
                      icon: 'add-circle-outline',
                      onPress: () => setCreateOpen(true),
                    },
                    {
                      label: t('books.bulkAddSlots'),
                      icon: 'add-outline',
                      onPress: () => setBulkOpen(true),
                    },
                    {
                      label: t('books.bulkScanBooks'),
                      icon: 'scan-outline',
                      onPress: () => navigation.navigate('BulkAssign'),
                    },
                  ]}
                />
              </>
            )}
          </>
        )}
      </View>

      {/* ── Selection hint banner ────────────────────────────────────────── */}
      {selectMode && (
        <View style={s.selectionBanner}>
          <Text style={s.selectionBannerText}>{t('books.selectionHint')}</Text>
        </View>
      )}

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[s.scroll, selectMode && { paddingBottom: 100 }]}
        refreshControl={
          !selectMode ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={D.PRIMARY}
              colors={[D.PRIMARY]}
            />
          ) : undefined
        }
      >
        {/* ── Stats Row (admin only) ──────────────────────────────────── */}
        {isAdmin && (
          <View style={s.statsRow}>
            <View style={[s.statCard, s.flex1]}>
              <Text style={[s.statValue, { color: D.SUCCESS }]}>
                {summary?.active ?? '—'}
              </Text>
              <Text style={s.statLabel}>Active</Text>
            </View>
            <View style={[s.statCard, s.flex1]}>
              <Text style={[s.statValue, { color: D.SUBTLE }]}>
                {summary?.sold ?? '—'}
              </Text>
              <Text style={s.statLabel}>Sold</Text>
            </View>
            <View style={[s.statCard, s.flex1]}>
              <Text style={[s.statValue, { color: D.WARNING }]}>
                {emptySlotCount}
              </Text>
              <Text style={s.statLabel}>Need Books</Text>
            </View>
          </View>
        )}

        {/* ── Bulk Assign (admin only, most prominent) ─────────────────── */}
        {isAdmin && !selectMode && (
          <TouchableOpacity
            style={s.bulkAssignCard}
            onPress={() => navigation.navigate('BulkAssign')}
            activeOpacity={0.85}
          >
            <View style={s.bulkAssignIconWrap}>
              <Ionicons name="scan-outline" size={26} color={D.PRIMARY} />
            </View>
            <View style={s.bulkAssignBody}>
              <Text style={s.bulkAssignTitle}>Bulk Assign Books</Text>
              <Text style={s.bulkAssignSub}>
                Scan barcodes to assign all empty slots
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}

        {/* ── Slots section ────────────────────────────────────────────── */}
        {slots.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📦</Text>
            <Text style={s.emptyTitle}>No slots yet</Text>
            <Text style={s.emptySub}>
              Add slots to start tracking lottery books
            </Text>
            {isAdmin && (
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => setCreateOpen(true)}
              >
                <Text style={s.emptyBtnText}>Add First Slot</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {!selectMode && <Text style={s.slotsLabel}>Slots</Text>}
            {slots.map((slot) => (
              <SlotCard
                key={slot.slot_id}
                slot={slot}
                t={t}
                isAdmin={isAdmin}
                selectMode={selectMode}
                selected={selectedIds.has(slot.slot_id)}
                onPress={() => handleSlotPress(slot)}
                onLongPress={() => handleLongPress(slot)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Floating delete bar (selection mode) ─────────────────────────── */}
      {selectMode && selectedIds.size > 0 && (
        <SafeAreaView edges={['bottom']} style={s.actionBar}>
          <TouchableOpacity
            style={[s.deleteBtn, deleting && s.dimmed]}
            onPress={confirmBulkDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.deleteBtnText}>
                {t('books.deleteSelected', { count: selectedIds.size })}
              </Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
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

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[s.skeletonCard, { opacity }]}>
      <View style={s.skeletonLine} />
      <View style={[s.skeletonLine, { width: '50%', marginTop: 10 }]} />
    </Animated.View>
  );
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

function SlotCard({ slot, t, isAdmin, selectMode, selected, onPress, onLongPress }) {
  const hasBook = !!slot.current_book;
  const disabled = selectMode && hasBook;
  const assignedDate = hasBook
    ? formatShortDate(slot.current_book.assigned_at || slot.current_book.created_at)
    : null;

  return (
    <TouchableOpacity
      style={[
        s.slotCard,
        !hasBook && s.slotCardEmpty,
        selected && s.slotCardSelected,
        disabled && s.slotCardDisabled,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      {/* ── Row 1: indicator · name · price | right action ── */}
      <View style={s.slotRow}>
        <View style={s.slotRowLeft}>
          {selectMode ? (
            <View
              style={[
                s.checkbox,
                selected && s.checkboxSelected,
                disabled && s.checkboxDimmed,
              ]}
            >
              {selected && <Text style={s.checkmark}>✓</Text>}
            </View>
          ) : (
            <View
              style={[
                s.slotDot,
                { backgroundColor: hasBook ? D.PRIMARY : D.WARNING },
              ]}
            />
          )}
          <Text style={s.slotName} numberOfLines={1}>{slot.slot_name}</Text>
          <View
            style={[
              s.pricePill,
              { backgroundColor: hasBook ? '#DBEAFE' : '#FEF3C7' },
            ]}
          >
            <Text
              style={[
                s.pricePillText,
                { color: hasBook ? D.PRIMARY : D.WARNING },
              ]}
            >
              ${slot.ticket_price}
            </Text>
          </View>
        </View>

        {/* Right side */}
        {!selectMode && (
          hasBook ? (
            <View style={s.slotRowRight}>
              <Text style={s.bookCode} numberOfLines={1}>{slot.current_book.static_code}</Text>
              <View style={s.activePill}>
                <Text style={s.activePillText}>Active</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={D.SUBTLE} />
            </View>
          ) : (
            isAdmin && (
              <TouchableOpacity
                style={s.assignBtn}
                onPress={onPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.assignBtnText}>Assign</Text>
              </TouchableOpacity>
            )
          )
        )}
      </View>

      {/* ── Row 2: book detail meta ── */}
      {hasBook && !selectMode && (
        <View style={s.slotMeta}>
          <Text style={s.metaText}>
            {'Book: '}
            {slot.current_book.static_code}
            {slot.current_book.book_name ? `  ·  ${slot.current_book.book_name}` : ''}
          </Text>
          {assignedDate != null && (
            <Text style={s.metaText}>Assigned: {assignedDate}</Text>
          )}
        </View>
      )}

      {/* ── Select-mode disabled hint ── */}
      {selectMode && hasBook && (
        <Text style={s.hasBooksText}>{t('books.hasBookBadge')}</Text>
      )}
    </TouchableOpacity>
  );
}

// ── CreateSlotModal ───────────────────────────────────────────────────────────

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
        style={s.modalBackdrop}
      >
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>{t('books.newSlotTitle')}</Text>

          <Text style={s.label}>{t('books.slotName')}</Text>
          <TextInput
            style={s.input}
            value={slotName}
            onChangeText={setSlotName}
            placeholder={t('books.slotNamePlaceholder')}
            autoFocus
          />

          <Text style={s.label}>{t('books.ticketPrice')}</Text>
          <View style={s.priceGrid}>
            {VALID_PRICES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.priceOption, price === p && s.priceOptionActive]}
                onPress={() => setPrice(p)}
              >
                <Text
                  style={[
                    s.priceOptionText,
                    price === p && s.priceOptionTextActive,
                  ]}
                >
                  ${p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.modalActions}>
            <TouchableOpacity
              style={[s.modalButton, s.modalCancel]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={s.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalButton, s.modalConfirm, busy && s.disabled]}
              onPress={handleCreate}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.modalConfirmText}>{t('books.create')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: D.BACKGROUND },

  // ── header
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
  headerTitle:   { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelSelectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BR.sm,
    backgroundColor: '#F1F5F9',
  },
  cancelSelectText: { color: D.TEXT, fontWeight: FW.semibold, fontSize: FS.sm },

  // ── selection banner
  selectionBanner: {
    backgroundColor: '#FEF9EE',
    paddingVertical: 10,
    paddingHorizontal: SP.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  selectionBannerText: { color: '#92400E', fontSize: FS.xs, fontWeight: FW.medium },

  // ── scroll
  scroll: { paddingTop: SP.md, paddingBottom: 40 },

  // ── stats row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SP.lg,
    gap: SP.sm,
    marginBottom: SP.md,
  },
  flex1:     { flex: 1 },
  statCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    padding: SP.md,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  statValue: { fontSize: FS.xl, fontWeight: FW.bold, color: D.TEXT },
  statLabel: { fontSize: FS.xs, color: D.SUBTLE, marginTop: 2 },

  // ── bulk assign card
  bulkAssignCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.PRIMARY,
    borderRadius: BR.lg,
    marginHorizontal: SP.lg,
    marginBottom: SP.md,
    padding: SP.lg,
    gap: SP.md,
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  bulkAssignIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: D.CARD,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bulkAssignBody:  { flex: 1 },
  bulkAssignTitle: { fontSize: FS.lg, fontWeight: FW.bold, color: '#FFFFFF' },
  bulkAssignSub:   { fontSize: FS.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // ── slots section label
  slotsLabel: {
    fontSize: FS.md,
    fontWeight: FW.bold,
    color: D.TEXT,
    marginHorizontal: SP.lg,
    marginBottom: SP.sm,
  },

  // ── slot card
  slotCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    marginHorizontal: SP.lg,
    marginBottom: SP.sm,
    paddingVertical: 14,
    paddingHorizontal: SP.lg,
    ...CARD_SHADOW,
  },
  slotCardEmpty: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: D.WARNING,
  },
  slotCardSelected: {
    borderWidth: 1.5,
    borderColor: D.PRIMARY,
    backgroundColor: '#EFF6FF',
  },
  slotCardDisabled: { opacity: 0.45 },

  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    flex: 1,
    marginRight: SP.sm,
  },
  slotRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    flexShrink: 0,
  },

  slotDot:  { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  slotName: { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT, flexShrink: 1 },

  pricePill: {
    paddingHorizontal: SP.sm,
    paddingVertical: 3,
    borderRadius: BR.full,
    flexShrink: 0,
  },
  pricePillText: { fontSize: FS.xs, fontWeight: FW.semibold },

  bookCode:      { fontSize: FS.sm, color: D.SUBTLE, maxWidth: 90 },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    borderRadius: BR.full,
  },
  activePillText: { fontSize: FS.xs, fontWeight: FW.semibold, color: D.SUCCESS },

  assignBtn: {
    backgroundColor: D.WARNING,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BR.full,
    flexShrink: 0,
  },
  assignBtnText: { color: '#FFFFFF', fontWeight: FW.semibold, fontSize: FS.sm },

  slotMeta: { marginTop: SP.sm, gap: 2 },
  metaText:  { fontSize: FS.xs, color: D.SUBTLE },

  hasBooksText: {
    fontSize: FS.xs,
    color: D.SUBTLE,
    fontStyle: 'italic',
    marginTop: SP.xs,
  },

  // ── checkbox (select mode)
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: D.SUBTLE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: D.CARD,
    flexShrink: 0,
  },
  checkboxSelected: { borderColor: D.PRIMARY, backgroundColor: D.PRIMARY },
  checkboxDimmed:   { borderColor: D.BORDER, backgroundColor: '#F1F5F9' },
  checkmark:        { color: '#fff', fontSize: 13, fontWeight: FW.bold },

  // ── empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: SP.xl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyIcon:  { fontSize: 64, marginBottom: SP.md },
  emptyTitle: {
    fontSize: FS.lg,
    fontWeight: FW.bold,
    color: D.TEXT,
    marginBottom: SP.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: FS.sm,
    color: D.SUBTLE,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SP.xl,
  },
  emptyBtn: {
    height: 52,
    backgroundColor: D.PRIMARY,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    shadowColor: D.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },

  // ── skeleton
  skeletonCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.md,
    padding: SP.lg,
    marginHorizontal: SP.lg,
    marginBottom: SP.sm,
    height: 80,
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  skeletonLine: {
    height: 14,
    backgroundColor: D.BORDER,
    borderRadius: BR.sm,
    width: '70%',
  },

  // ── floating action bar (bulk delete)
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: D.CARD,
    paddingHorizontal: SP.lg,
    paddingTop: SP.md,
    paddingBottom: SP.sm,
    borderTopWidth: 1,
    borderTopColor: D.BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  deleteBtn: {
    height: 52,
    backgroundColor: D.ERROR,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontWeight: FW.bold, fontSize: FS.md },
  dimmed: { opacity: 0.5 },

  // ── create slot modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: D.CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: FS.xl, fontWeight: FW.bold, color: D.TEXT, marginBottom: SP.lg },
  label: {
    fontSize: FS.sm,
    color: D.SUBTLE,
    marginBottom: SP.xs,
    marginTop: SP.md,
    fontWeight: FW.semibold,
  },
  input: {
    borderWidth: 1.5,
    borderColor: D.BORDER,
    borderRadius: BR.md,
    padding: SP.md,
    fontSize: FS.md,
    color: D.TEXT,
    backgroundColor: D.BACKGROUND,
  },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm },
  priceOption: {
    paddingHorizontal: SP.lg,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: D.BORDER,
    borderRadius: BR.md,
  },
  priceOptionActive:     { borderColor: D.PRIMARY, backgroundColor: '#EFF6FF' },
  priceOptionText:       { color: D.SUBTLE, fontWeight: FW.semibold, fontSize: FS.sm },
  priceOptionTextActive: { color: D.PRIMARY },
  modalActions: { flexDirection: 'row', gap: SP.md, marginTop: SP.xl },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BR.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancel:      { backgroundColor: '#F1F5F9' },
  modalCancelText:  { color: D.TEXT, fontWeight: FW.semibold },
  modalConfirm:     { backgroundColor: D.PRIMARY },
  modalConfirmText: { color: '#fff', fontWeight: FW.semibold },
  disabled:         { opacity: 0.6 },
});
