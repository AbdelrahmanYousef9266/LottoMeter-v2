import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

import { logout } from '../api/auth';
import { changeStorePin, changeScanMode } from '../api/store';
import { useAuth } from '../context/AuthContext';
import { setStoredLanguage } from '../i18n';
import { syncRTL } from '../utils/rtl';
import { getSoundEnabled, setSoundEnabled, getVibrationEnabled, setVibrationEnabled } from '../hooks/useFeedback';

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

const LANGUAGES = [
  { label: 'English',  value: 'en', flag: '🇺🇸', description: 'English (United States)' },
  { label: 'العربية', value: 'ar', flag: '🇯🇴', description: 'Arabic (Right to Left)'   },
];

const SCAN_MODES = [
  {
    label: 'Hardware Scanner',
    value: 'hardware_scanner',
    description: 'For Zebra, Honeywell, or Bluetooth scanners',
  },
  {
    label: 'Camera — Single',
    value: 'camera_single',
    description: 'Tap to scan one barcode at a time',
  },
  {
    label: 'Camera — Continuous',
    value: 'camera_continuous',
    description: 'Camera stays open for rapid scanning',
  },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { user, setUser, store, setStore, scanMode } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [vibrationEnabled, setVibrationEnabledState] = useState(true);

  useEffect(() => {
    getSoundEnabled().then(setSoundEnabledState);
    getVibrationEnabled().then(setVibrationEnabledState);
  }, []);

  async function handleSoundToggle(value) {
    setSoundEnabledState(value);
    await setSoundEnabled(value);
  }

  async function handleVibrationToggle(value) {
    setVibrationEnabledState(value);
    await setVibrationEnabled(value);
  }

  const [pinFormOpen, setPinFormOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [scanModeSaving, setScanModeSaving] = useState(false);
  const [scanModePickerOpen, setScanModePickerOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  function confirmLogout() {
    Alert.alert(
      t('auth.logoutConfirmTitle'),
      t('auth.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            setUser(null);
            setStore(null);
          },
        },
      ]
    );
  }

  async function handleLanguageChange(lang) {
    if (lang === i18n.language || busy) return;
    setLangPickerOpen(false);
    setBusy(true);
    try {
      await i18n.changeLanguage(lang);
      await setStoredLanguage(lang);
      syncRTL(lang);
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  function resetPinForm() {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  }

  async function handleSavePin() {
    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      Alert.alert(t('settings.pinFormatTitle'), t('settings.pinFormatHint'));
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert(t('settings.pinMismatchTitle'), t('settings.pinMismatchHint'));
      return;
    }
    setPinSaving(true);
    try {
      await changeStorePin({ current_pin: currentPin, new_pin: newPin });
      resetPinForm();
      setPinFormOpen(false);
      Alert.alert(t('settings.pinChangedTitle'), t('settings.pinChangedHint'));
    } catch (err) {
      if (err.code === 'INVALID_PIN') {
        Alert.alert(t('settings.currentPinWrongTitle'), t('settings.currentPinWrongHint'));
      } else if (err.code === 'INVALID_PIN_FORMAT') {
        Alert.alert(t('settings.pinFormatTitle'), t('settings.pinFormatHint'));
      } else {
        Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
      }
    } finally {
      setPinSaving(false);
    }
  }

  async function handleScanModeChange(newMode) {
    if (newMode === scanMode || scanModeSaving) return;
    setScanModePickerOpen(false);
    setScanModeSaving(true);
    try {
      const result = await changeScanMode(newMode);
      setStore({ ...(store || {}), scan_mode: result.scan_mode });
      Alert.alert(t('settings.scanModeUpdatedTitle'), t('settings.scanModeUpdatedHint'));
    } catch (err) {
      Alert.alert(err.code || t('common.error'), err.message || t('common.tryAgain'));
    } finally {
      setScanModeSaving(false);
    }
  }

  const currentLang = LANGUAGES.find(l => l.value === i18n.language);
  const currentMode = SCAN_MODES.find(m => m.value === scanMode);
  const initials    = getInitials(user?.username || '');

  return (
    <SafeAreaView style={s.root}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── User Profile Card ───────────────────────────────────────────── */}
        <View style={s.profileCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName} numberOfLines={1}>
              {user?.username || `#${user?.user_id}`}
            </Text>
            {isAdmin ? (
              <View style={s.roleAdminPill}>
                <Text style={s.roleAdminText}>Admin</Text>
              </View>
            ) : (
              <View style={s.roleEmployeePill}>
                <Text style={s.roleEmployeeText}>Employee</Text>
              </View>
            )}
            <Text style={s.profileStore} numberOfLines={1}>
              {store?.store_name || `Store #${user?.store_id}`}
            </Text>
            {!!store?.store_code && (
              <Text style={s.profileCode}>{store.store_code}</Text>
            )}
          </View>
        </View>

        {/* ── PREFERENCES ─────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.sectionCard}>

          {/* Scan Mode */}
          <TouchableOpacity
            style={s.settingRow}
            onPress={() => setScanModePickerOpen(true)}
            disabled={scanModeSaving}
            activeOpacity={0.7}
          >
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Text style={s.iconText}>📷</Text>
              </View>
              <Text style={s.rowLabel}>{t('settings.scanMode')}</Text>
            </View>
            <View style={s.rowRight}>
              {scanModeSaving ? (
                <ActivityIndicator size="small" color={D.PRIMARY} />
              ) : (
                <Text style={s.rowValue} numberOfLines={1}>
                  {currentMode?.label || 'Select…'}
                </Text>
              )}
              {!scanModeSaving && <Text style={s.chevron}>›</Text>}
            </View>
          </TouchableOpacity>

          <View style={s.rowDivider} />

          {/* Language */}
          <TouchableOpacity
            style={s.settingRow}
            onPress={() => setLangPickerOpen(true)}
            disabled={busy}
            activeOpacity={0.7}
          >
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Text style={s.iconText}>🌐</Text>
              </View>
              <Text style={s.rowLabel}>{t('settings.language')}</Text>
            </View>
            <View style={s.rowRight}>
              {busy ? (
                <ActivityIndicator size="small" color={D.PRIMARY} />
              ) : (
                <Text style={s.rowValue}>
                  {currentLang ? `${currentLang.flag} ${currentLang.label}` : 'Select…'}
                </Text>
              )}
              {!busy && <Text style={s.chevron}>›</Text>}
            </View>
          </TouchableOpacity>

          <View style={s.rowDivider} />

          {/* Sound Feedback */}
          <View style={s.settingRow}>
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                <Text style={s.iconText}>🔊</Text>
              </View>
              <Text style={s.rowLabel}>{t('settings.scan_feedback_sound')}</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ false: D.BORDER, true: D.PRIMARY }}
              thumbColor="#fff"
            />
          </View>

          <View style={s.rowDivider} />

          {/* Vibration Feedback */}
          <View style={s.settingRow}>
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: '#FFF7ED' }]}>
                <Text style={s.iconText}>📳</Text>
              </View>
              <Text style={s.rowLabel}>{t('settings.scan_feedback_vibration')}</Text>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={handleVibrationToggle}
              trackColor={{ false: D.BORDER, true: D.PRIMARY }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── ACCOUNT ─────────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.sectionCard}>

          {/* Manage Users — admin only */}
          {isAdmin && (
            <>
              <TouchableOpacity
                style={s.settingRow}
                onPress={() => navigation.navigate('Users')}
                activeOpacity={0.7}
              >
                <View style={s.rowLeft}>
                  <View style={[s.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={s.iconText}>👥</Text>
                  </View>
                  <Text style={s.rowLabel}>{t('users.title')}</Text>
                </View>
                <View style={s.rowRight}>
                  <Text style={s.chevron}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={s.rowDivider} />
            </>
          )}

          {/* Change PIN — admin only */}
          {isAdmin && (
            <>
              <TouchableOpacity
                style={s.settingRow}
                onPress={() => setPinFormOpen(true)}
                activeOpacity={0.7}
              >
                <View style={s.rowLeft}>
                  <View style={[s.iconCircle, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={s.iconText}>🔑</Text>
                  </View>
                  <Text style={s.rowLabel}>{t('settings.storePin')}</Text>
                </View>
                <View style={s.rowRight}>
                  <Text style={s.rowValue}>{t('settings.changePin')}</Text>
                  <Text style={s.chevron}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={s.rowDivider} />
            </>
          )}

          {/* About */}
          <TouchableOpacity
            style={s.settingRow}
            onPress={() =>
              Alert.alert('LottoMeter v2.0', 'Built for convenience stores\n\n© 2026 LottoMeter')
            }
            activeOpacity={0.7}
          >
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: '#F1F5F9' }]}>
                <Text style={s.iconText}>ℹ️</Text>
              </View>
              <Text style={s.rowLabel}>About LottoMeter</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowValue}>v2.0</Text>
              <Text style={s.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── DANGER ZONE ─────────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>DANGER ZONE</Text>
        <View style={s.sectionCard}>
          <TouchableOpacity
            style={s.settingRow}
            onPress={confirmLogout}
            activeOpacity={0.7}
          >
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Text style={s.iconText}>🚪</Text>
              </View>
              <Text style={[s.rowLabel, { color: D.ERROR }]}>{t('auth.logout')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Scan Mode Bottom Sheet ──────────────────────────────────────────── */}
      <Modal
        visible={scanModePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setScanModePickerOpen(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setScanModePickerOpen(false)}
        >
          <View style={s.bottomSheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{t('settings.scanMode')}</Text>
            </View>
            {SCAN_MODES.map((mode, i) => {
              const isSelected = scanMode === mode.value;
              return (
                <TouchableOpacity
                  key={mode.value}
                  style={[s.sheetOption, i < SCAN_MODES.length - 1 && s.sheetOptionBorder]}
                  onPress={() => handleScanModeChange(mode.value)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sheetOptionLabel, isSelected && s.sheetOptionSelected]}>
                      {mode.label}
                    </Text>
                    <Text style={s.sheetOptionDesc}>{mode.description}</Text>
                  </View>
                  {isSelected && <Text style={s.sheetCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={s.sheetCancel}
              onPress={() => setScanModePickerOpen(false)}
            >
              <Text style={s.sheetCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Language Bottom Sheet ───────────────────────────────────────────── */}
      <Modal
        visible={langPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLangPickerOpen(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangPickerOpen(false)}
        >
          <View style={s.bottomSheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{t('settings.language')}</Text>
            </View>
            {LANGUAGES.map((lang, i) => {
              const isSelected = i18n.language === lang.value;
              return (
                <TouchableOpacity
                  key={lang.value}
                  style={[s.sheetOption, i < LANGUAGES.length - 1 && s.sheetOptionBorder]}
                  onPress={() => handleLanguageChange(lang.value)}
                  activeOpacity={0.7}
                >
                  <Text style={s.langFlag}>{lang.flag}</Text>
                  <View style={{ flex: 1, marginLeft: SP.md }}>
                    <Text style={[s.sheetOptionLabel, isSelected && s.sheetOptionSelected]}>
                      {lang.label}
                    </Text>
                    <Text style={s.sheetOptionDesc}>{lang.description}</Text>
                  </View>
                  {isSelected && <Text style={s.sheetCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={s.sheetCancel}
              onPress={() => setLangPickerOpen(false)}
            >
              <Text style={s.sheetCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── PIN Change Bottom Sheet ─────────────────────────────────────────── */}
      <Modal
        visible={pinFormOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { resetPinForm(); setPinFormOpen(false); }}
      >
        <View style={s.modalOverlay}>
          <View style={s.bottomSheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{t('settings.changePin')}</Text>
            </View>
            <View style={s.pinBody}>
              <Text style={s.pinLabel}>{t('settings.currentPin')}</Text>
              <TextInput
                style={s.pinInput}
                value={currentPin}
                onChangeText={(text) => setCurrentPin(text.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                placeholderTextColor={D.SUBTLE}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />
              <Text style={s.pinLabel}>{t('settings.newPin')}</Text>
              <TextInput
                style={s.pinInput}
                value={newPin}
                onChangeText={(text) => setNewPin(text.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                placeholderTextColor={D.SUBTLE}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />
              <Text style={s.pinLabel}>{t('settings.confirmPin')}</Text>
              <TextInput
                style={s.pinInput}
                value={confirmPin}
                onChangeText={(text) => setConfirmPin(text.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                placeholderTextColor={D.SUBTLE}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />
              <View style={s.pinActions}>
                <TouchableOpacity
                  style={[s.pinBtn, s.pinBtnCancel]}
                  onPress={() => { resetPinForm(); setPinFormOpen(false); }}
                  disabled={pinSaving}
                >
                  <Text style={s.pinBtnCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.pinBtn, s.pinBtnSave, pinSaving && s.dimmed]}
                  onPress={handleSavePin}
                  disabled={pinSaving}
                >
                  {pinSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.pinBtnSaveText}>{t('settings.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.BACKGROUND },

  // ── header ────────────────────────────────────────────────────────────────────
  header: {
    height: 56,
    backgroundColor: D.CARD,
    borderBottomWidth: 1,
    borderBottomColor: D.BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT },

  // ── profile card ──────────────────────────────────────────────────────────────
  profileCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    margin: SP.lg,
    padding: SP.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: D.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: FS.xl, fontWeight: FW.bold, color: '#fff' },
  profileInfo: { flex: 1, marginLeft: SP.md },
  profileName:  { fontSize: FS.lg, fontWeight: FW.bold, color: D.TEXT, marginBottom: SP.xs },
  profileStore: { fontSize: FS.sm, color: D.SUBTLE, marginTop: SP.xs },
  profileCode:  { fontSize: FS.xs, color: D.SUBTLE },

  roleAdminPill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    borderRadius: BR.full,
    alignSelf: 'flex-start',
    marginBottom: SP.xs,
  },
  roleAdminText:    { fontSize: FS.xs, fontWeight: FW.semibold, color: D.PRIMARY },
  roleEmployeePill: {
    backgroundColor: D.BORDER,
    paddingHorizontal: SP.sm,
    paddingVertical: 2,
    borderRadius: BR.full,
    alignSelf: 'flex-start',
    marginBottom: SP.xs,
  },
  roleEmployeeText: { fontSize: FS.xs, fontWeight: FW.semibold, color: D.SUBTLE },

  // ── section labels ────────────────────────────────────────────────────────────
  sectionLabel: {
    paddingHorizontal: SP.lg,
    paddingTop: SP.lg,
    paddingBottom: SP.sm,
    fontSize: FS.xs,
    fontWeight: FW.semibold,
    color: D.SUBTLE,
    letterSpacing: 1,
  },

  // ── section card ──────────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: D.CARD,
    borderRadius: BR.lg,
    marginHorizontal: SP.lg,
    marginBottom: SP.md,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },

  // ── setting rows ──────────────────────────────────────────────────────────────
  settingRow: {
    minHeight: 56,
    paddingHorizontal: SP.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft:    { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowRight:   { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  rowDivider: { height: 1, backgroundColor: D.BORDER, marginLeft: 64 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText:  { fontSize: FS.lg },
  rowLabel:  { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT, marginLeft: SP.md },
  rowValue:  { fontSize: FS.sm, color: D.SUBTLE, marginRight: SP.xs, maxWidth: 140 },
  chevron:   { fontSize: FS.xl, color: D.SUBTLE },

  // ── bottom sheet modals ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: D.CARD,
    borderTopLeftRadius: BR.lg,
    borderTopRightRadius: BR.lg,
    overflow: 'hidden',
  },
  sheetHeader: {
    padding: SP.lg,
    borderBottomWidth: 1,
    borderBottomColor: D.BORDER,
  },
  sheetTitle:        { fontSize: FS.md, fontWeight: FW.bold, color: D.TEXT },
  sheetOption:       { padding: SP.lg, flexDirection: 'row', alignItems: 'center' },
  sheetOptionBorder: { borderBottomWidth: 1, borderBottomColor: D.BORDER },
  sheetOptionLabel:  { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT },
  sheetOptionSelected: { color: D.PRIMARY },
  sheetOptionDesc:   { fontSize: FS.sm, color: D.SUBTLE, marginTop: 2 },
  sheetCheck:        { fontSize: FS.lg, color: D.PRIMARY, fontWeight: FW.bold, marginLeft: SP.sm },
  sheetCancel: {
    margin: SP.sm,
    marginBottom: SP.lg,
    height: 52,
    backgroundColor: D.BACKGROUND,
    borderRadius: BR.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT },
  langFlag:        { fontSize: 24 },

  // ── pin modal body ────────────────────────────────────────────────────────────
  pinBody:   { padding: SP.lg, paddingBottom: SP.xl },
  pinLabel:  { fontSize: FS.sm, fontWeight: FW.semibold, color: D.SUBTLE, marginBottom: SP.xs, marginTop: SP.md },
  pinInput:  {
    borderWidth: 1.5,
    borderColor: D.BORDER,
    borderRadius: BR.md,
    padding: SP.md,
    fontSize: FS.lg,
    color: D.TEXT,
    backgroundColor: D.BACKGROUND,
  },
  pinActions:      { flexDirection: 'row', gap: SP.sm, marginTop: SP.lg },
  pinBtn:          { flex: 1, height: 48, borderRadius: BR.md, justifyContent: 'center', alignItems: 'center' },
  pinBtnCancel:    { backgroundColor: D.BACKGROUND, borderWidth: 1, borderColor: D.BORDER },
  pinBtnCancelText: { fontSize: FS.md, fontWeight: FW.semibold, color: D.TEXT },
  pinBtnSave:      { backgroundColor: D.PRIMARY },
  pinBtnSaveText:  { fontSize: FS.md, fontWeight: FW.bold, color: '#fff' },
  dimmed:          { opacity: 0.6 },
});
