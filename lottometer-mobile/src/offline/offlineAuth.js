import * as SecureStore from 'expo-secure-store';
import settings from '../config/settings';

const SESSION_KEY = 'lm_offline_session';

export const saveOfflineSession = async (user, store, token) => {
  const expiresAt = new Date();
  expiresAt.setHours(
    expiresAt.getHours() + settings.OFFLINE_SESSION_EXPIRY_HOURS
  );

  const session = {
    user_id:    user.user_id,
    username:   user.username,
    role:       user.role,
    store_id:   store.store_id,
    store_code: store.store_code,
    store_name: store.store_name,
    scan_mode:  store.scan_mode || 'hardware_scanner',
    owner_name: store.owner_name,
    address:    store.address,
    city:       store.city,
    state:      store.state,
    zip_code:   store.zip_code,
    token:      token || null,
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
};

export const hasOfflineAccess = async () => {
  const session = await getOfflineSession();
  return session !== null;
};
