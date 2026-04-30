import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../theme';

const PRESETS = {
  open:    { bg: Colors.successDark, color: Colors.success },
  closed:  { bg: Colors.navyDark,    color: Colors.textMuted },
  active:  { bg: '#0D2247',          color: Colors.primary },
  correct: { bg: Colors.successDark, color: Colors.success },
  over:    { bg: Colors.warningDark, color: Colors.warning },
  short:   { bg: Colors.errorDark,   color: Colors.error },
  voided:  { bg: Colors.errorDark,   color: Colors.error },
};

export default function StatusBadge({ status, voided, label, style }) {
  const key = voided ? 'voided' : (status || 'closed');
  const preset = PRESETS[key] ?? PRESETS.closed;

  return (
    <View style={[styles.badge, { backgroundColor: preset.bg }, style]}>
      <Text style={[styles.text, { color: preset.color }]}>
        {label ?? key.charAt(0).toUpperCase() + key.slice(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
