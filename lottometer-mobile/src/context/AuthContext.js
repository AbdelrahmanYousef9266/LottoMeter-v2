import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken } from '../api/client';
import { getMe } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await getMe();
          // /auth/me returns: { user_id, store_id, role, username, store }
          setUser({
            user_id: me.user_id,
            store_id: me.store_id,
            role: me.role,
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