import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors, Radius } from '../theme';

const VARIANT_COLORS = {
  primary: Colors.primary,
  success: Colors.success,
  danger:  Colors.error,
  ghost:   'transparent',
};

export default function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
  variant = 'primary',
  size = 'md',
}) {
  const bg = VARIANT_COLORS[variant] ?? Colors.primary;
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        { backgroundColor: bg },
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? Colors.primary : '#fff'} />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'sm' && styles.textSm,
            size === 'lg' && styles.textLg,
            isGhost && styles.textGhost,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  sm: { paddingVertical: 10, paddingHorizontal: 16, minHeight: 40 },
  lg: { paddingVertical: 18, paddingHorizontal: 24, minHeight: 58 },
  ghost: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  disabled: { opacity: 0.5 },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSm: { fontSize: 13 },
  textLg: { fontSize: 17 },
  textGhost: { color: Colors.primary },
});
