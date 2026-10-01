import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { ButtonProps } from 'react-native-paper';
import { useDesignSystem } from '../hooks/useDesignSystem';

interface PremiumButtonProps extends Omit<ButtonProps, 'labelStyle'> {
  children: string;
}

export function PremiumButton({ children, style, icon, ...props }: PremiumButtonProps) {
  const ds = useDesignSystem();
  const labelStyle = [
    { fontSize: ds.typography.label.fontSize, lineHeight: ds.typography.label.lineHeight, fontWeight: '600' as const, letterSpacing: -0.2, marginHorizontal: 8 },
    icon ? styles.labelWithIcon : null,
  ].filter(Boolean);
  return (
    <Button
      {...props}
      icon={icon}
      style={[styles.button, style]}
      labelStyle={labelStyle}
      contentStyle={styles.content}
      uppercase={false}
      compact={false}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
  },
  content: {
    minHeight: 48,
    paddingHorizontal: 12,
  },
  labelWithIcon: {
    marginLeft: 22,
  },
});
