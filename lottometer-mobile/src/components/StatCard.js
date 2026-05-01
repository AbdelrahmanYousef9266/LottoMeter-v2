import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '../theme';

export default function StatCard({ label, value, icon, accentColor, style }) {
  const color = accentColor || Colors.primary;

  return (
    <View style={[styles.card, style]}>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: Colors.primaryLight }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
      )}
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={[styles.value, { color }]} numberOfLines={1}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    ...Shadow.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '600',
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
