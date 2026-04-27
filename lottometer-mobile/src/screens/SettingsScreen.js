import React, { useState } from 'react';
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
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

import { logout } from '../api/auth';
import { changeStorePin } from '../api/store';
import { useAuth } from '../context/AuthContext';
import { setStoredLanguage } from '../i18n';
import { syncRTL } from '../utils/rtl';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { user, setUser } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [busy, setBusy] = useState(false);

  // PIN change state
  const [pinFormOpen, setPinFormOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

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
        Alert.alert(
          t('settings.restartTitle'),
          t('settings.restartMessage'),
          [{ text: t('common.ok') }]
        );
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('settings.account')}</Text>
          <Text style={styles.text}>
            {t('settings.user')}: {user?.username || `#${user?.user_id}`}
          </Text>
          <Text style={styles.text}>
            {t('settings.role')}: {user?.role}
          </Text>
          <Text style={styles.text}>
            {t('settings.store')}: #{user?.store_id}
          </Text>
        </View>

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
                <Text
                  style={[
                    styles.langText,
                    isActive && styles.langTextActive,
                  ]}
                >
                  {lang.native}
                </Text>
                {isActive && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('users.manageUsers')}</Text>
            <Text style={styles.helperText}>{t('users.manageUsersHint')}</Text>
            <TouchableOpacity
              style={styles.manageUsersButton}
              onPress={() => navigation.navigate('Users')}
            >
              <Text style={styles.manageUsersButtonText}>{t('users.title')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('settings.storePin')}</Text>
            <Text style={styles.helperText}>{t('settings.storePinHint')}</Text>

            {!pinFormOpen ? (
              <TouchableOpacity
                style={styles.changePinButton}
                onPress={() => setPinFormOpen(true)}
              >
                <Text style={styles.changePinButtonText}>
                  {t('settings.changePin')}
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.label}>{t('settings.currentPin')}</Text>
                <TextInput
                  style={styles.input}
                  value={currentPin}
                  onChangeText={(text) =>
                    setCurrentPin(text.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />

                <Text style={styles.label}>{t('settings.newPin')}</Text>
                <TextInput
                  style={styles.input}
                  value={newPin}
                  onChangeText={(text) =>
                    setNewPin(text.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />

                <Text style={styles.label}>{t('settings.confirmPin')}</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPin}
                  onChangeText={(text) =>
                    setConfirmPin(text.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="••••"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />

                <View style={styles.pinActions}>
                  <TouchableOpacity
                    style={[styles.pinButton, styles.cancelButton]}
                    onPress={() => {
                      resetPinForm();
                      setPinFormOpen(false);
                    }}
                    disabled={pinSaving}
                  >
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pinButton,
                      styles.saveButton,
                      pinSaving && styles.disabled,
                    ]}
                    onPress={handleSavePin}
                    disabled={pinSaving}
                  >
                    {pinSaving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveText}>{t('settings.save')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  scroll: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  text: { fontSize: 14, color: '#333', marginBottom: 6 },
  helperText: { fontSize: 12, color: '#888', marginBottom: 12 },

  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  langOptionActive: { backgroundColor: '#e8f0fe' },
  langText: { fontSize: 15, color: '#333', fontWeight: '500' },
  langTextActive: { color: '#1a73e8', fontWeight: '700' },
  checkmark: { color: '#1a73e8', fontSize: 18, fontWeight: '700' },

  manageUsersButton: {
    backgroundColor: '#1a73e8',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageUsersButtonText: { color: '#fff', fontWeight: '600' },

  changePinButton: {
    backgroundColor: '#1a73e8',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  changePinButtonText: { color: '#fff', fontWeight: '600' },

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
  pinActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  pinButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelText: { color: '#444', fontWeight: '600' },
  saveButton: { backgroundColor: '#16a34a' },
  saveText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.6 },

  logoutButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});