import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '../theme';

export default function AppText({
  children,
  variant = 'body',  // 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'label' | 'caption'
  color,
  style,
  numberOfLines,
  ...rest
}) {
  return (
    <Text
      style={[styles[variant], color && { color }, style]}
      numberOfLines={numberOfLines}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  h1:        { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  h2:        { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  h3:        { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  body:      { fontSize: 15, fontWeight: '400', color: Colors.textPrimary, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', color: Colors.textSecondary, lineHeight: 19 },
  label:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.2 },
  caption:   { fontSize: 11, fontWeight: '500', color: Colors.textMuted,     letterSpacing: 0.3 },
});
