import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { logout } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { setStoredLanguage } from '../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);

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
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
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

        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f5f7' },
  inner: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  text: { fontSize: 14, color: '#333', marginBottom: 6 },

  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  langOptionActive: {
    backgroundColor: '#e8f0fe',
  },
  langText: { fontSize: 15, color: '#333', fontWeight: '500' },
  langTextActive: { color: '#1a73e8', fontWeight: '700' },
  checkmark: { color: '#1a73e8', fontSize: 18, fontWeight: '700' },

  logoutButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});