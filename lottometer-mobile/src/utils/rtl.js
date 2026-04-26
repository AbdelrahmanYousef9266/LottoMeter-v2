import { I18nManager } from 'react-native';
import { isRTL } from '../i18n';

/**
 * Sync React Native's I18nManager to the current language.
 * Returns true if a reload is needed (the RTL state changed),
 * false if no change.
 */
export function syncRTL(lang) {
  const shouldBeRTL = isRTL(lang);
  const currentlyRTL = I18nManager.isRTL;

  if (shouldBeRTL === currentlyRTL) {
    return false; // no change needed
  }

  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);
  return true; // reload needed
}