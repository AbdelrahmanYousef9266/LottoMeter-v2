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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

import { logout } from '../api/auth';
import { clearOfflineSession, clearLocalDatabase } from '../offline';
import { changeStorePin, changeScanMode } from '../api/store';
import { useAuth } from '../context/AuthContext';
import { setStoredLanguage } from '../i18n';
import { syncRTL } from '../utils/rtl';
import { getSoundEnabled, setSoundEnabled, getVibrationEnabled, setVibrationEnabled } from '../hooks/useFeedback';
import { Colors, Radius, Shadow } from '../theme';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
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
            clearOfflineSession().catch(console.warn);
            clearLocalDatabase().catch(console.warn);
            setUser(null);
          },
        },
      ]
    );
  }

  async function handleLanguageChange(lang) {
    if (lang === i18n.language || busy) return;
    setBusy(true);
    try {
      await setStoredLanguage(lang);
      const reloadNeeded = syncRTL(lang);
      if (reloadNeeded) {
        Alert.alert(t('settings.restartTitle'), t('settings.restartMessage'), [{ text: t('common.ok') }]);
      }
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

          <ScanModeOption
            code="camera_single"
            label={t('settings.scanModeSingle')}
            description={t('settings.scanModeSingleDesc')}
            active={scanMode === 'camera_single'}
            onPress={() => handleScanModeChange('camera_single')}
            disabled={scanModeSaving}
          />
          <ScanModeOption
            code="camera_continuous"
            label={t('settings.scanModeContinuous')}
            description={t('settings.scanModeContinuousDesc')}
            active={scanMode === 'camera_continuous'}
            onPress={() => handleScanModeChange('camera_continuous')}
            disabled={scanModeSaving}
          />
          <ScanModeOption
            code="hardware_scanner"
            label={t('settings.scanModeHardware')}
            description={t('settings.scanModeHardwareDesc')}
            active={scanMode === 'hardware_scanner'}
            onPress={() => handleScanModeChange('hardware_scanner')}
            disabled={scanModeSaving}
          />
        </View>

        {/* 6. Language */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.language')}</Text>
          <Text style={styles.helperText}>{t('settings.languageHint')}</Text>
          {LANGUAGES.map((lang) => {
            const isActive = i18n.language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langOption, isActive && styles.langOptionActive]}
                onPress={() => handleLanguageChange(lang.code)}
                disabled={busy}
              >
                <Text style={[styles.langText, isActive && styles.langTextActive]}>
                  {lang.native}
                </Text>
                {isActive && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScanModeOption({ label, description, active, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.scanModeOption, active && styles.scanModeOptionActive]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.scanModeRow}>
        <View style={[styles.scanModeRadio, active && styles.scanModeRadioActive]}>
          {active && <View style={styles.scanModeRadioInner} />}
        </View>
        <View style={styles.scanModeTextWrap}>
          <Text style={[styles.scanModeLabel, active && styles.scanModeLabelActive]}>
            {label}
          </Text>
          <Text style={styles.scanModeDescription}>{description}</Text>
        </View>
      </View>
    </TouchableOpacity>
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

  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  langOptionActive: { backgroundColor: Colors.primaryLight },
  langText:         { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  langTextActive:   { color: Colors.primary, fontWeight: '700' },
  checkmark:        { color: Colors.primary, fontSize: 18, fontWeight: '700' },

  scanModeOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  scanModeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  scanModeRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  scanModeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  scanModeRadioActive:  { borderColor: Colors.primary },
  scanModeRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  scanModeTextWrap:    { flex: 1 },
  scanModeLabel:       { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  scanModeLabelActive: { color: Colors.primary },
  scanModeDescription: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

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
