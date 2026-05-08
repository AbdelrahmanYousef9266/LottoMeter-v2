import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getToken, saveToken } from '../api/client';
import { getMe } from '../api/auth';
import { setSessionContext } from '../offline/sessionStore';
import { startSyncListener, syncPendingItems } from '../offline/syncEngine';
import { seedLocalDatabase } from '../offline/seed';
import { getOfflineSession } from '../offline/offlineAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Startup auth check
  useEffect(() => {
    (async () => {
      try {
        // Skip token validation when offline — avoids getMe() hanging
        // indefinitely on Android (axios timeout unreliable with no connectivity),
        // which would keep loading=true and block RootNavigator forever.
        const netState = await NetInfo.fetch();
        if (!netState.isConnected || netState.isInternetReachable === false) {
          // Restore JWT from offline session so API calls work when internet returns
          const session = await getOfflineSession();
          if (session?.token) {
            await saveToken(session.token);
          }
          return; // setLoading(false) runs in finally
        }

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
          // Restore session context so write-through works after app reload
          if (me.store) {
            setSessionContext(me.user_id, me.store.store_id);
          }
        }
      } catch (_) {
        // Token invalid/expired
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // NetInfo listener for offline detection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected || state.isInternetReachable === false);
    });
    NetInfo.fetch().then(state => {
      setIsOffline(!state.isConnected || state.isInternetReachable === false);
    });
    return () => unsubscribe();
  }, []);

  // Sync listener — starts when user is logged in, auto-syncs on reconnect
  useEffect(() => {
    if (!user) return;

    const unsubscribe = startSyncListener(
      async () => {
        // Delay gives SecureStore time to flush the token before axios fires
        await new Promise(resolve => setTimeout(resolve, 1000));
        await syncPendingItems();
        if (store?.store_id && user?.user_id) {
          seedLocalDatabase(store.store_id, user.user_id).catch(console.warn);
        }
      },
      undefined
    );

    return () => unsubscribe();
  }, [user]);

  // Helper: pull scan_mode out of the store, with a safe default
  const scanMode = store?.scan_mode || 'hardware_scanner';

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
