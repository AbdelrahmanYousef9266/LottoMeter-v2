import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradient, Radius } from '../theme';

export default function AppButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',   // 'primary' | 'outline' | 'ghost' | 'danger' | 'success'
  size = 'md',           // 'sm' | 'md' | 'lg'
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;
  const sizeStyle   = SIZE_STYLES[size]   ?? SIZE_STYLES.md;
  const textSize    = TEXT_SIZES[size]    ?? TEXT_SIZES.md;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[styles.base, sizeStyle, isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={Gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={[styles.textLight, textSize, textStyle]}>{title}</Text>
          }
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const FLAT = {
    outline: { bg: 'transparent',   text: Colors.primary, border: Colors.primary },
    ghost:   { bg: 'transparent',   text: Colors.primary, border: 'transparent' },
    danger:  { bg: Colors.error,    text: '#fff',         border: 'transparent' },
    success: { bg: Colors.accent,   text: '#fff',         border: 'transparent' },
  };
  const cfg = FLAT[variant] ?? FLAT.outline;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        sizeStyle,
        {
          backgroundColor: cfg.bg,
          borderWidth:  cfg.border === 'transparent' ? 0 : 1.5,
          borderColor:  cfg.border,
        },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={cfg.text} />
        : <Text style={[styles.text, textSize, { color: cfg.text }, textStyle]}>{title}</Text>
      }
    </TouchableOpacity>
  );
}

const SIZE_STYLES = {
  sm: { height: 40 },
  md: { height: 52 },
  lg: { height: 56 },
};

const TEXT_SIZES = {
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 16 },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  text:      { fontWeight: '700', letterSpacing: 0.2 },
  textLight: { color: '#fff', fontWeight: '700', letterSpacing: 0.2 },
});
