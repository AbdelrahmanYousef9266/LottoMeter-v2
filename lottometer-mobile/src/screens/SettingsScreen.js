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
import { Colors, Radius, Shadow } from '../theme';

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        {/* 1. Account */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.account')}</Text>
          <Text style={styles.text}>{t('settings.user')}: {user?.username || `#${user?.user_id}`}</Text>
          <Text style={styles.text}>{t('settings.role')}: {user?.role}</Text>
          <Text style={styles.text}>{t('settings.store')}: #{user?.store_id}</Text>
        </View>

        {/* 2. Manage Users (admin only) */}
        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('users.manageUsers')}</Text>
            <Text style={styles.helperText}>{t('users.manageUsersHint')}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Users')}
            >
              <Text style={styles.actionButtonText}>{t('users.title')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Store PIN (admin only) */}
        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('settings.storePin')}</Text>
            <Text style={styles.helperText}>{t('settings.storePinHint')}</Text>

            {!pinFormOpen ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setPinFormOpen(true)}
              >
                <Text style={styles.actionButtonText}>{t('settings.changePin')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.label}>{t('settings.currentPin')}</Text>
                <TextInput
                  style={styles.input}
                  value={currentPin}
                  onChangeText={(text) => setCurrentPin(text.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />

                <Text style={styles.label}>{t('settings.newPin')}</Text>
                <TextInput
                  style={styles.input}
                  value={newPin}
                  onChangeText={(text) => setNewPin(text.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />

                <Text style={styles.label}>{t('settings.confirmPin')}</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPin}
                  onChangeText={(text) => setConfirmPin(text.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />

                <View style={styles.pinActions}>
                  <TouchableOpacity
                    style={[styles.pinButton, styles.cancelButton]}
                    onPress={() => { resetPinForm(); setPinFormOpen(false); }}
                    disabled={pinSaving}
                  >
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pinButton, styles.saveButton, pinSaving && styles.disabled]}
                    onPress={handleSavePin}
                    disabled={pinSaving}
                  >
                    {pinSaving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.saveText}>{t('settings.save')}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* 4. Scan Feedback */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.scan_feedback')}</Text>
          <Text style={styles.helperText}>{t('settings.scan_feedback_subtitle')}</Text>

          <View style={[styles.feedbackRow, { marginTop: 16 }]}>
            <View style={styles.feedbackTextWrap}>
              <Text style={styles.toggleLabel}>{t('settings.scan_feedback_sound')}</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.feedbackRow, { marginTop: 12 }]}>
            <View style={styles.feedbackTextWrap}>
              <Text style={styles.toggleLabel}>{t('settings.scan_feedback_vibration')}</Text>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={handleVibrationToggle}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* 5. Scan Mode */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.scanMode')}</Text>
          <Text style={styles.helperText}>{t('settings.scanModeHint')}</Text>

          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setScanModePickerOpen(true)}
            disabled={scanModeSaving}
            activeOpacity={0.7}
          >
            <View style={styles.dropdownTriggerContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownValue}>
                  {SCAN_MODES.find(m => m.value === scanMode)?.label || 'Select…'}
                </Text>
                <Text style={styles.dropdownDesc}>
                  {SCAN_MODES.find(m => m.value === scanMode)?.description || ''}
                </Text>
              </View>
              {scanModeSaving
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.dropdownChevron}>▾</Text>
              }
            </View>
          </TouchableOpacity>

          <Modal
            visible={scanModePickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setScanModePickerOpen(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setScanModePickerOpen(false)}
            >
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Select Scan Mode</Text>
                {SCAN_MODES.map((mode) => {
                  const isSelected = scanMode === mode.value;
                  return (
                    <TouchableOpacity
                      key={mode.value}
                      style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                      onPress={() => handleScanModeChange(mode.value)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalOptionContent}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalOptionLabel, isSelected && styles.modalOptionLabelActive]}>
                            {mode.label}
                          </Text>
                          <Text style={styles.modalOptionDesc}>{mode.description}</Text>
                        </View>
                        {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setScanModePickerOpen(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        {/* 6. Language */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.language')}</Text>
          <Text style={styles.helperText}>{t('settings.languageHint')}</Text>

          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setLangPickerOpen(true)}
            disabled={busy}
            activeOpacity={0.7}
          >
            <View style={styles.dropdownTriggerContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownValue}>
                  {(() => {
                    const cur = LANGUAGES.find(l => l.value === i18n.language);
                    return cur ? `${cur.flag}  ${cur.label}` : 'Select…';
                  })()}
                </Text>
                <Text style={styles.dropdownDesc}>
                  {LANGUAGES.find(l => l.value === i18n.language)?.description || ''}
                </Text>
              </View>
              {busy
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.dropdownChevron}>▾</Text>
              }
            </View>
          </TouchableOpacity>

          <Modal
            visible={langPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setLangPickerOpen(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setLangPickerOpen(false)}
            >
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('settings.language')}</Text>
                {LANGUAGES.map((lang) => {
                  const isSelected = i18n.language === lang.value;
                  return (
                    <TouchableOpacity
                      key={lang.value}
                      style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                      onPress={() => handleLanguageChange(lang.value)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalOptionContent}>
                        <Text style={styles.langFlag}>{lang.flag}</Text>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.modalOptionLabel, isSelected && styles.modalOptionLabelActive]}>
                            {lang.label}
                          </Text>
                          <Text style={styles.modalOptionDesc}>{lang.description}</Text>
                        </View>
                        {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setLangPickerOpen(false)}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll:    { padding: 16, paddingBottom: 32 },
  title:     { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardTitle:  { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  text:       { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  helperText: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },

  langFlag: { fontSize: 24 },

  dropdownTrigger: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    backgroundColor: Colors.inputBg,
  },
  dropdownTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dropdownDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dropdownChevron: {
    fontSize: 20,
    color: Colors.textMuted,
    marginLeft: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: Colors.primaryLight,
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOptionLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  modalOptionLabelActive: {
    color: Colors.primary,
  },
  modalOptionDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalCheckmark: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '700',
    marginLeft: 8,
  },
  modalCancel: {
    marginTop: 8,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  actionButton: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    fontSize: 16,
    backgroundColor: Colors.inputBg,
    color: Colors.textPrimary,
  },
  pinActions:   { flexDirection: 'row', gap: 12, marginTop: 16 },
  pinButton:    { flex: 1, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  cancelButton: { backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border },
  cancelText:   { color: Colors.textSecondary, fontWeight: '600' },
  saveButton:   { backgroundColor: Colors.accent },
  saveText:     { color: '#fff', fontWeight: '600' },
  disabled:     { opacity: 0.6 },

  feedbackRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedbackTextWrap: { flex: 1, marginRight: 12 },
  toggleLabel:     { fontSize: 15, color: Colors.textPrimary },

  logoutButton: {
    backgroundColor: Colors.error,
    padding: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
