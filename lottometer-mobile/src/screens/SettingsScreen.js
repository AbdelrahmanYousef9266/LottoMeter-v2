import React from 'react';
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

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();

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
    marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  text: { fontSize: 14, color: '#333', marginBottom: 6 },
  logoutButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});