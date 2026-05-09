import { useEffect, useCallback } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SOUND = 'scan_feedback_sound_enabled';
const STORAGE_KEY_VIBRATION = 'scan_feedback_vibration_enabled';

const SOUND_FILES = {
  success: require('../../assets/sounds/scan1.wav'),
  error: require('../../assets/sounds/scan2.wav'),
  last_ticket: require('../../assets/sounds/lastscan.wav'),
  shift_closed: require('../../assets/sounds/shiftclosed.wav'),
};

const HAPTIC_TYPES = {
  success: Haptics.NotificationFeedbackType.Success,
  error: Haptics.NotificationFeedbackType.Error,
  last_ticket: Haptics.NotificationFeedbackType.Success,
  shift_closed: Haptics.NotificationFeedbackType.Success,
};

// Allow beeps to play even when the iOS silent switch is on.
// Employees toggle silent mode often; they rely on scan audio regardless.
setAudioModeAsync({ playsInSilentMode: true });

// Module-level mutable holders — seeded from AsyncStorage on first hook mount;
// setSoundEnabled/setVibrationEnabled write here immediately so the live
// useFeedback instance in ScanScreen sees toggle changes without a re-mount.
let _soundEnabled = true;
let _vibrationEnabled = true;

export function useFeedback() {
  const successPlayer = useAudioPlayer(SOUND_FILES.success);
  const errorPlayer = useAudioPlayer(SOUND_FILES.error);
  const lastTicketPlayer = useAudioPlayer(SOUND_FILES.last_ticket);
  const shiftClosedPlayer = useAudioPlayer(SOUND_FILES.shift_closed);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_SOUND).then((value) => {
      _soundEnabled = value !== 'false';
    });
    AsyncStorage.getItem(STORAGE_KEY_VIBRATION).then((value) => {
      _vibrationEnabled = value !== 'false';
    });
  }, []);

  const fire = useCallback(
    async (type) => {
      if (_soundEnabled) {
        const players = {
          success: successPlayer,
          error: errorPlayer,
          last_ticket: lastTicketPlayer,
          shift_closed: shiftClosedPlayer,
        };
        const player = players[type];
        if (player) {
          try {
            player.seekTo(0);
            player.play();
          } catch (e) {
            console.error('[useFeedback] PLAYBACK FAILED:', e);
          }
        }
      }
      if (_vibrationEnabled) {
        try {
          await Haptics.notificationAsync(HAPTIC_TYPES[type]);
        } catch (e) {
          // Haptics may not be supported on all devices; ignore
        }
      }
    },
    [successPlayer, errorPlayer, lastTicketPlayer, shiftClosedPlayer]
  );

  return fire;
}

export async function setSoundEnabled(enabled) {
  _soundEnabled = enabled;
  await AsyncStorage.setItem(STORAGE_KEY_SOUND, enabled ? 'true' : 'false');
}

export async function getSoundEnabled() {
  const value = await AsyncStorage.getItem(STORAGE_KEY_SOUND);
  return value !== 'false';
}

export async function setVibrationEnabled(enabled) {
  _vibrationEnabled = enabled;
  await AsyncStorage.setItem(STORAGE_KEY_VIBRATION, enabled ? 'true' : 'false');
}

export async function getVibrationEnabled() {
  const value = await AsyncStorage.getItem(STORAGE_KEY_VIBRATION);
  return value !== 'false';
}
