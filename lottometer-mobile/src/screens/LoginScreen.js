import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [storeCode, setStoreCode] = useState('LM001');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!storeCode || !username || !password) {
      Alert.alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    setBusy(true);
    try {
      const data = await login({ store_code: storeCode, username, password });
      setUser(data.user);
    } catch (err) {
      Alert.alert(
        t('auth.loginFailed'),
        err.message || t('auth.couldNotLogIn')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>{t('auth.appName')}</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

          <Text style={styles.label}>{t('auth.storeCode')}</Text>
          <TextInput
            style={styles.input}
            value={storeCode}
            onChangeText={setStoreCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="LM001"
          />

          <Text style={styles.label}>{t('auth.username')}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="admin"
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a73e8',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    color: '#333',
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
  button: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});