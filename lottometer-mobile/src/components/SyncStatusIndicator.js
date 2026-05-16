import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme';
import { getSyncQueueStats } from '../offline/localDb';

const POLL_INTERVAL_MS = 10000;

const ZERO_STATS = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };

export default function SyncStatusIndicator() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(ZERO_STATS);
  const intervalRef    = useRef(null);
  const appStateRef    = useRef(AppState.currentState);

  const poll = async () => {
    try {
      const s = await getSyncQueueStats();
      setStats(s);
    } catch (e) {
      console.error('[SyncStatusIndicator] poll failed:', e);
      // Default to green on error — never crash the screen
    }
  };

  const startPolling = () => {
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startPolling();

    const sub = AppState.addEventListener('change', next => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        startPolling();
      } else if (next.match(/inactive|background/)) {
        stopPolling();
      }
      appStateRef.current = next;
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { pending, syncing, failed } = stats;

  if (failed > 0) {
    const label = failed > 9 ? '9+' : String(failed);
    return (
      <TouchableOpacity
        onPress={() =>
          Alert.alert(
            t('sync.indicator.failedTitle'),
            t('sync.indicator.failedMessage', { count: failed }),
          )
        }
        accessibilityLabel={t('sync.indicator.failedA11y', { count: failed })}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: Colors.error,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 18 }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  if (syncing > 0 || pending > 0) {
    return (
      <ActivityIndicator
        size="small"
        color={Colors.warning}
        accessibilityLabel={t('sync.indicator.syncingA11y')}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={t('sync.indicator.syncedA11y')}
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.success,
      }}
    />
  );
}
