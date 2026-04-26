import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import ar from './locales/ar.json';

const STORAGE_KEY = 'lottometer_lang';

export const SUPPORTED_LANGUAGES = ['en', 'ar'];
export const DEFAULT_LANGUAGE = 'en';

/**
 * Detect initial language: stored preference > device locale > English fallback.
 */
async function detectInitialLanguage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
  } catch (_) {
    // ignore
  }

  // Try device locale
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const code = (locales[0].languageCode || '').toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(code)) {
        return code;
      }
    }
  } catch (_) {
    // ignore
  }

  return DEFAULT_LANGUAGE;
}

export async function setStoredLanguage(lang) {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export function isRTL(lang) {
  return ['ar', 'ur'].includes(lang);
}

export async function initI18n() {
  const lng = await detectInitialLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        ar: { translation: ar },
      },
      lng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // React already escapes
      },
      compatibilityJSON: 'v4',
    });

  return i18n;
}

export default i18n;