import * as SecureStore from 'expo-secure-store';

// SecureStore is hardware-backed (iOS Keychain / Android Keystore) so values
// are already encrypted at rest — no additional hashing layer needed.

const PIN_KEY = 'lottometer_pin';
const SESSION_KEY = 'lottometer_offline_session';
const PIN_EXPIRY_HOURS = 72;

// Save offline PIN after successful online login
export const setupOfflinePin = async (pin) => {
  if (pin.length < 4 || pin.length > 6) {
    throw new Error('PIN must be 4-6 digits');
  }
  await SecureStore.setItemAsync(PIN_KEY, pin);
  return true;
};

// Verify offline PIN
export const verifyOfflinePin = async (pin) => {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;
  return stored === pin;
};

// Save offline session after online login
export const saveOfflineSession = async (user, store) => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PIN_EXPIRY_HOURS);

  const session = {
    user_id:    user.user_id,
    username:   user.username,
    role:       user.role,
    store_id:   store?.store_id,
    store_code: store?.store_code,
    store_name: store?.store_name,
    scan_mode:  store?.scan_mode || 'camera_single',
    expires_at: expiresAt.toISOString(),
    saved_at:   new Date().toISOString(),
  };

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
};

// Get offline session — returns null if missing or expired
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

// Clear offline session on logout
export const clearOfflineSession = async () => {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(PIN_KEY);
};

// Check if offline login is possible (session + PIN both present and valid)
export const hasOfflineAccess = async () => {
  const session = await getOfflineSession();
  const pin = await SecureStore.getItemAsync(PIN_KEY);
  return session !== null && pin !== null;
};
