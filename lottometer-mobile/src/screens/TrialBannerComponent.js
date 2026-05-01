import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Colors } from '../theme';

const PRICING_URL = 'https://lottometer.com/pricing';

export default function TrialBannerComponent({ subscription }) {
  const [dismissed, setDismissed] = useState(false);

  if (!subscription || subscription.status !== 'trial' || dismissed) {
    return null;
  }

  const days = subscription.days_remaining ?? 0;
  const dayLabel = `${days} day${days === 1 ? '' : 's'} remaining`;

  return (
    <View style={styles.banner}>
      <TouchableOpacity
        style={styles.content}
        onPress={() => Linking.openURL(PRICING_URL)}
        activeOpacity={0.7}
      >
        <Text style={styles.text}>
          ⏳ Trial: <Text style={styles.bold}>{dayLabel}</Text>
          {' '}— Subscribe to continue
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.warningBg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: { flex: 1 },
  text: { fontSize: 13, color: Colors.warning, lineHeight: 18 },
  bold: { fontWeight: '700' },
  dismissText: { fontSize: 14, color: Colors.warning, fontWeight: '700', paddingLeft: 10 },
});
