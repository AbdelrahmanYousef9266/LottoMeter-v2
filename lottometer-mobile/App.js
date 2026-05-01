import React, { useEffect, useState, useRef } from 'react';
import { Animated, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initI18n } from './src/i18n';

SplashScreen.preventAutoHideAsync();

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableInExpoDevelopment: false,
    debug: false,
    tracesSampleRate: 0.1,
    environment: __DEV__ ? 'development' : 'production',
  });
}

function App() {
  const [appReady, setAppReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initI18n()
      .catch(e => console.warn('i18n init error:', e))
      .finally(() => setAppReady(true));
  }, []);

  useEffect(() => {
    if (!appReady) return;
    SplashScreen.hideAsync().catch(console.warn);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [appReady, fadeAnim]);

  if (!appReady) return null;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="dark" />
        </AuthProvider>
      </SafeAreaProvider>
    </Animated.View>
  );
}

export default sentryDsn ? Sentry.wrap(App) : App;
