import * as SecureStore from 'expo-secure-store';
import settings from '../config/settings';

const PIN_HASH_KEY = 'lm_pin_hash';
const SESSION_KEY = 'lm_offline_session';
const ATTEMPTS_KEY = 'lm_pin_attempts';

// Simple but consistent hash — no crypto module in RN
// In production consider expo-crypto for SHA-256
const hashPin = (pin, salt) => {
  const str = pin + salt + 'lottometer2026';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

export const setupOfflinePin = async (pin, userId) => {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits');
  }
  const hash = hashPin(pin, userId.toString());
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
  return true;
};

export const verifyOfflinePin = async (pin, userId) => {
  const attemptsStr = await SecureStore.getItemAsync(ATTEMPTS_KEY);
  const attempts = parseInt(attemptsStr || '0');

  if (attempts >= settings.OFFLINE_MAX_PIN_ATTEMPTS) {
    throw new Error('Too many failed attempts. Please login online.');
  }

  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!storedHash) return false;

  const inputHash = hashPin(pin, userId.toString());

  if (inputHash === storedHash) {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
    return true;
  } else {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, (attempts + 1).toString());
    return false;
  }
};

export const saveOfflineSession = async (user, store) => {
  const expiresAt = new Date();
  expiresAt.setHours(
    expiresAt.getHours() + settings.OFFLINE_SESSION_EXPIRY_HOURS
  );

  const session = {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    store_id: store.store_id,
    store_code: store.store_code,
    store_name: store.store_name,
    scan_mode: store.scan_mode || 'camera_single',
    expires_at: expiresAt.toISOString(),
  };

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const getOfflineSession = async () => {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  const session = JSON.parse(raw);
  if (new Date() > new Date(session.expires_at)) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }

  return session;
};

export const clearOfflineSession = async () => {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
};

export const hasOfflineAccess = async () => {
  const session = await getOfflineSession();
  const pin = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return session !== null && pin !== null;
};
