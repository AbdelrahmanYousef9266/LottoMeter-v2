import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';

import { login } from '../api/auth';
import { saveToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  saveOfflineSession,
  seedLocalDatabase,
  saveLocalStore,
  saveLocalUser,
  getOfflineSession,
} from '../offline';
import { setSessionContext } from '../offline/sessionStore';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import { Colors, Radius, Shadow } from '../theme';

// ─── rotating description lines ──────────────────────────────────────────────

const TAGLINES = [
  'Track lottery shifts in seconds',
  'Scan books faster with zero errors',
  'Simplify daily store operations',
];

function RotatingTagline() {
  const [index, setIndex] = useState(0);
  const opacity    = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const cycle = setInterval(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0,   duration: 280, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        setIndex(i => (i + 1) % TAGLINES.length);
        translateY.setValue(12);
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]).start();
      });
    }, 2600);
    return () => clearInterval(cycle);
  }, [opacity, translateY]);

  return (
    <Animated.Text
      style={[styles.tagline, { opacity, transform: [{ translateY }] }]}
      numberOfLines={1}
    >
      {TAGLINES[index]}
    </Animated.Text>
  );
}

// ─── screen ──────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { setUser, setStore } = useAuth();

  // Online login fields
  const [storeCode, setStoreCode] = useState('LM001');
  const [username, setUsername]   = useState('admin');
  const [password, setPassword]   = useState('');
  const [busy, setBusy]           = useState(false);

  // Offline mode state
  const [isOfflineMode, setIsOfflineMode]     = useState(false);
  const [canLoginOffline, setCanLoginOffline] = useState(false);

  // Screen fade-in on mount
  const screenOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  // Check connectivity and attempt auto-session restore on mount
  useEffect(() => {
    checkOfflineAccess();
  }, []);

  const checkOfflineAccess = async () => {
    const netState = await NetInfo.fetch();
    const offline = !netState.isConnected;
    setIsOfflineMode(offline);

    if (offline) {
      const session = await getOfflineSession();
      if (session) {
        await restoreOfflineSession(session);
      } else {
        setCanLoginOffline(false);
      }
    }
  };

  const restoreOfflineSession = async (session) => {
    try {
      if (session.token) {
        await saveToken(session.token);
      }
      setSessionContext(session.user_id, session.store_id);
      // Set store before user — RootNavigator triggers on user, store must be ready first
      setStore({
        store_id: session.store_id,
        store_code: session.store_code,
        store_name: session.store_name,
        scan_mode: session.scan_mode || 'hardware_scanner',
      });
      setUser({
        user_id: session.user_id,
        username: session.username,
        role: session.role,
      });
    } catch (err) {
      console.warn('[offline] session restore failed:', err.message);
      setCanLoginOffline(false);
    }
  };

  // ── online login ──────────────────────────────────────────────────────────

  async function handleLogin() {
    if (!storeCode || !username || !password) {
      Alert.alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    setBusy(true);
    try {
      const data = await login({ store_code: storeCode, username, password });

      setSessionContext(data.user.user_id, data.store.store_id);
      saveOfflineSession(data.user, data.store, data.token).catch(console.warn);
      saveLocalStore(data.store).catch(console.warn);
      saveLocalUser(data.user, data.store.store_id).catch(console.warn);
      seedLocalDatabase(data.store?.store_id, data.user?.user_id)
        .catch(e => console.error('[login] Seed error:', e.message));

      setStore(data.store || null);
      setUser(data.user);
    } catch (err) {
      if (err.code === 'SUBSCRIPTION_EXPIRED') {
        navigation.navigate('SubscriptionExpired');
      } else {
        Alert.alert(t('auth.loginFailed'), err.message || t('auth.couldNotLogIn'));
      }
    } finally {
      setBusy(false);
    }
  }

  // ── render — offline: no stored session ──────────────────────────────────

  if (isOfflineMode && !canLoginOffline) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC',
                             justifyContent: 'center',
                             alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📡</Text>
        <Text style={{ fontSize: 20, fontWeight: '700',
                       color: '#0F172A', marginBottom: 8,
                       textAlign: 'center' }}>
          No Internet Connection
        </Text>
        <Text style={{ fontSize: 15, color: '#64748B',
                       textAlign: 'center', lineHeight: 22 }}>
          Connect to the internet to login.{'\n'}
          Once logged in, you can work offline.
        </Text>
      </SafeAreaView>
    );
  }

  // ── render — normal online login ──────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ opacity: screenOpacity }}
        >
          {/* ── header ─────────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Image
                source={require('../../assets/app-icon.png')}
                style={styles.icon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>LottoMeter</Text>
            <Text style={styles.appSubtitle}>Digital Shift Tracking</Text>
            <View style={styles.taglineWrap}>
              <RotatingTagline />
            </View>
          </View>

          {/* ── form card ──────────────────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('auth.signIn')}</Text>
            <Text style={styles.cardSubtitle}>{t('auth.subtitle')}</Text>

            <AppInput
              label={t('auth.storeCode')}
              value={storeCode}
              onChangeText={setStoreCode}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="LM001"
              style={styles.field}
            />

            <AppInput
              label={t('auth.username')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="admin"
              style={styles.field}
            />

            <AppInput
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              style={styles.field}
            />

            <AppButton
              title={t('auth.signIn')}
              onPress={handleLogin}
              loading={busy}
              disabled={busy}
              size="lg"
              style={styles.loginButton}
            />
          </View>

          {/* ── footer note ────────────────────────────────────────────────── */}
          <Text style={styles.footerNote}>
            Contact your store manager for access
          </Text>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex:     { flex: 1 },
  scroll:   {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },

  // ── header ─────────────────────────────────────────────────────────────────
  header: { alignItems: 'center', marginBottom: 28 },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  icon: { width: 68, height: 68 },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  taglineWrap: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    textAlign: 'center',
  },

  // ── card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  cardTitle:    { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  field:        { marginBottom: 14 },
  loginButton:  { marginTop: 8 },

  // ── footer ─────────────────────────────────────────────────────────────────
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 24,
  },
});
