import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getToken, clearToken } from '../api/client';
import { getMe, logout as apiLogout } from '../api/auth';
import { clearLocalDatabase, clearOfflineSession } from '../offline';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [store, setStore]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Restore session on app launch
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await getMe();
          // /auth/me returns: { user_id, store_id, role, username, store }
          setUser({
            user_id:  me.user_id,
            store_id: me.store_id,
            role:     me.role,
            username: me.username,
          });
          setStore(me.store || null);
        }
      } catch (_) {
        // Token invalid/expired
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Track connectivity; update isOffline on every network state change
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  // Full logout: clears JWT, local DB, and offline session
  const logout = async () => {
    try { await apiLogout(); } catch (_) {}
    await clearToken();
    try { await clearLocalDatabase(); } catch (_) {}
    try { await clearOfflineSession(); } catch (_) {}
    setUser(null);
    setStore(null);
  };

  // Helper: pull scan_mode out of the store, with a safe default
  const scanMode = store?.scan_mode || 'camera_single';

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        store,
        setStore,
        scanMode,
        loading,
        isOffline,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
