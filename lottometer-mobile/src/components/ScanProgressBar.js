import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../theme';

export default function ScanProgressBar({ current, total, style }) {
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const done = pct === 1;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Books Scanned</Text>
        <Text style={[styles.count, done && styles.countDone]}>
          {current} / {total}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${(pct * 100).toFixed(1)}%` },
            done && styles.fillDone,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: Colors.textFaint,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  count: {
    fontSize: 13,
    color: Colors.textWhite,
    fontWeight: '700',
  },
  countDone: { color: Colors.success },
  track: {
    height: 6,
    backgroundColor: Colors.navyDark,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  fillDone: { backgroundColor: Colors.success },
});
