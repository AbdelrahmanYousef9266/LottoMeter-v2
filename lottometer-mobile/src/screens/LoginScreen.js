import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  Modal,
  TextInput,
  TouchableOpacity,
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
  hasOfflineAccess,
  getOfflineSession,
  verifyOfflinePin,
  setupOfflinePin,
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
  const [offlinePin, setOfflinePin]           = useState('');
  const [canLoginOffline, setCanLoginOffline] = useState(false);

  // PIN setup modal state (shown after successful online login)
  const [showPinSetup, setShowPinSetup]         = useState(false);
  const [pinSetupValue, setPinSetupValue]       = useState('');
  const [pinSetupConfirm, setPinSetupConfirm]   = useState('');
  const [pendingUser, setPendingUser]           = useState(null);
  const [pendingStore, setPendingStore]         = useState(null);

  // Screen fade-in on mount
  const screenOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(screenOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }, [screenOpacity]);

  // Check connectivity and offline access on mount
  useEffect(() => {
    const check = async () => {
      const netState = await NetInfo.fetch();
      const offline = !netState.isConnected;
      setIsOfflineMode(offline);

      if (offline) {
        const hasAccess = await hasOfflineAccess();
        setCanLoginOffline(hasAccess);
      }
    };
    check();
  }, []);

  // ── online login ──────────────────────────────────────────────────────────

  async function handleLogin() {
    if (!storeCode || !username || !password) {
      Alert.alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    setBusy(true);
    try {
      const data = await login({ store_code: storeCode, username, password });

      // Persist offline session data immediately
      setSessionContext(data.user.user_id, data.store.store_id);
      saveOfflineSession(data.user, data.store, data.token).catch(console.warn);
      saveLocalStore(data.store).catch(console.warn);
      saveLocalUser(data.user, data.store.store_id).catch(console.warn);
      seedLocalDatabase(data.store?.store_id, data.user?.user_id)
        .catch(e => console.error('[login] Seed error:', e.message));

      // Stash user/store for PIN setup modal; don't log in yet
      setPendingUser(data.user);
      setPendingStore(data.store);
      setPinSetupValue('');
      setPinSetupConfirm('');
      setShowPinSetup(true);
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

  function finishLogin(user, store) {
    setUser(user);
    setStore(store || null);
  }

  // ── PIN setup ─────────────────────────────────────────────────────────────

  async function handlePinSetup() {
    if (pinSetupValue !== pinSetupConfirm) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }
    if (!/^\d{4,6}$/.test(pinSetupValue)) {
      Alert.alert('Error', 'PIN must be 4-6 digits');
      return;
    }
    try {
      await setupOfflinePin(pinSetupValue, pendingUser.user_id);
      setShowPinSetup(false);
      finishLogin(pendingUser, pendingStore);
      Alert.alert('PIN Set', 'Your offline PIN has been set successfully.');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  function handleSkipPinSetup() {
    setShowPinSetup(false);
    finishLogin(pendingUser, pendingStore);
  }

  // ── offline PIN login ─────────────────────────────────────────────────────

  async function handleOfflinePinLogin() {
    if (!offlinePin || offlinePin.length < 4) {
      Alert.alert('Error', 'Please enter your 4-6 digit PIN');
      return;
    }
    setBusy(true);
    try {
      const session = await getOfflineSession();
      if (!session) {
        Alert.alert('Session Expired', 'Please connect to the internet to log in.');
        return;
      }

      const valid = await verifyOfflinePin(offlinePin, session.user_id);
      if (!valid) {
        Alert.alert('Invalid PIN', 'Incorrect PIN. Please try again.');
        return;
      }

      if (session.token) {
        await saveToken(session.token);
      }
      setSessionContext(session.user_id, session.store_id);
      // Set store before user — RootNavigator triggers on user, so store must
      // be ready before the navigation re-render happens.
      setStore({
        store_id: session.store_id,
        store_code: session.store_code,
        store_name: session.store_name,
        scan_mode: session.scan_mode || 'camera_single',
      });
      setUser({
        user_id: session.user_id,
        store_id: session.store_id,
        username: session.username,
        role: session.role,
      });
    } catch (err) {
      Alert.alert('Error', err.message || 'Offline login failed');
    } finally {
      setBusy(false);
    }
  }

  // ── render — offline: no stored session ──────────────────────────────────

  if (isOfflineMode && !canLoginOffline) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.offlineFallback}>
          <Text style={styles.offlineFallbackTitle}>No Internet Connection</Text>
          <Text style={styles.offlineFallbackSubtitle}>
            Please connect to the internet for your first login.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── render — offline: PIN login ───────────────────────────────────────────

  if (isOfflineMode && canLoginOffline) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F6FAFF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Image
            source={require('../../assets/app-icon.png')}
            style={{ width: 80, height: 80, marginBottom: 24 }}
          />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0A1128', marginBottom: 8 }}>
            LottoMeter
          </Text>
          <Text style={{ fontSize: 16, color: '#46627F', marginBottom: 32, textAlign: 'center' }}>
            ⚠️ Offline Mode{'\n'}Enter your PIN to continue
          </Text>
          <TextInput
            value={offlinePin}
            onChangeText={setOfflinePin}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            placeholder="Enter 4-6 digit PIN"
            placeholderTextColor="#94A3B8"
            returnKeyType="done"
            onSubmitEditing={handleOfflinePinLogin}
            style={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E2EAF4',
              borderRadius: 10,
              padding: 14,
              fontSize: 18,
              color: '#0A1128',
              textAlign: 'center',
              marginBottom: 16,
              letterSpacing: 8,
            }}
          />
          <TouchableOpacity
            onPress={handleOfflinePinLogin}
            disabled={busy}
            style={{
              width: '100%',
              backgroundColor: '#0077CC',
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
              {busy ? 'Logging in...' : 'Login with PIN'}
            </Text>
          </TouchableOpacity>
          <Text style={{ marginTop: 24, color: '#46627F', fontSize: 13 }}>
            Connect to internet for full access
          </Text>
        </View>
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

      {/* ── PIN setup modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showPinSetup}
        transparent
        animationType="slide"
        onRequestClose={handleSkipPinSetup}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Offline PIN</Text>
            <Text style={styles.modalSubtitle}>
              Set a 4-6 digit PIN so you can log in when you're offline.
            </Text>

            <Text style={styles.pinLabel}>PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={pinSetupValue}
              onChangeText={setPinSetupValue}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="4-6 digits"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.pinLabel}>Confirm PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={pinSetupConfirm}
              onChangeText={setPinSetupConfirm}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="Re-enter PIN"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handlePinSetup}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.skipButton]}
                onPress={handleSkipPinSetup}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.setPinButton]}
                onPress={handlePinSetup}
              >
                <Text style={styles.setPinButtonText}>Set PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // ── offline PIN login ───────────────────────────────────────────────────────
  offlinePinBanner: {
    backgroundColor: '#D97706',
    borderRadius: Radius.sm,
    padding: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  offlinePinBannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pinLabel:  { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  pinInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    fontSize: 20,
    letterSpacing: 6,
    backgroundColor: Colors.inputBg,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },

  // ── no-connection fallback ──────────────────────────────────────────────────
  offlineFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  offlineFallbackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  offlineFallbackSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── PIN setup modal ─────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle:    { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4, lineHeight: 20 },
  modalActions:  { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalButton:   { flex: 1, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  skipButton:    { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  skipButtonText: { color: Colors.textSecondary, fontWeight: '600' },
  setPinButton:  { backgroundColor: Colors.primary },
  setPinButtonText: { color: '#fff', fontWeight: '600' },
});
