import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Radius, Shadow } from '../theme';

const PRICING_URL = 'https://lottometer.com/pricing';
const SUPPORT_EMAIL = 'support@lottometer.com';

export default function SubscriptionExpiredScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.emoji}>⚠️</Text>

        <Text style={styles.title}>Subscription Expired</Text>

        <Text style={styles.message}>
          Your LottoMeter subscription has expired.{'\n'}
          Please renew to continue using the app.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => Linking.openURL(PRICING_URL)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Renew Subscription</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Contact Support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tryAgain}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.tryAgainText}>
            Already renewed? Tap here to try again
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  emoji: { fontSize: 64, marginBottom: 20 },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 36,
  },

  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: Radius.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    ...Shadow.sm,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  secondaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: Radius.md,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 36,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },

  tryAgain: { paddingVertical: 8 },
  tryAgainText: {
    fontSize: 13,
    color: Colors.primary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
