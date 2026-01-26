import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { ButtonProps } from 'react-native-paper';

interface PremiumButtonProps extends Omit<ButtonProps, 'labelStyle'> {
  children: string;
}

export function PremiumButton({ children, style, ...props }: PremiumButtonProps) {
  return (
    <Button
      {...props}
      style={[styles.button, style]}
      labelStyle={styles.label}
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
    height: 48,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 22,
    marginHorizontal: 8,
  },
});
