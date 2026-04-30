import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../theme';

export default function VarianceBadge({ amount, style, size = 'md' }) {
  const n = parseFloat(amount);
  const valid = !Number.isNaN(n);
  const isPos = valid && n > 0;
  const isNeg = valid && n < 0;

  const color = isPos ? Colors.success : isNeg ? Colors.error : Colors.textMuted;
  const bg    = isPos ? Colors.successDark : isNeg ? Colors.errorDark : Colors.navyDark;
  const prefix = isPos ? '+' : '';
  const display = valid ? `${prefix}$${Math.abs(n).toFixed(2)}` : '—';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color }, size === 'lg' && styles.textLg]}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
  },
  textLg: { fontSize: 20 },
});
