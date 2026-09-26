import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ColorRole } from '@/theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  /** Visible label; also the accessible name unless `accessibilityLabel` is given. */
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading icon. */
  icon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Stretch to the container width. */
  block?: boolean;
}

interface VariantColors {
  bg: ColorRole | null;
  bgPressed: ColorRole | null;
  fg: ColorRole;
  border: ColorRole | null;
}

const variantColors: Record<ButtonVariant, VariantColors> = {
  primary: { bg: 'primary', bgPressed: 'onPrimaryContainer', fg: 'onPrimary', border: null },
  secondary: { bg: 'primaryContainer', bgPressed: 'surfaceTint', fg: 'onPrimaryContainer', border: 'primary' },
  ghost: { bg: null, bgPressed: 'surfaceTint', fg: 'primary', border: null },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  block = false,
}: ButtonProps) {
  const theme = useTheme();
  const v = variantColors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      aria-disabled={inactive}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.sizes.touchTarget,
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.xl,
          gap: theme.spacing.sm,
          backgroundColor: (pressed && v.bgPressed ? theme.colors[v.bgPressed] : v.bg ? theme.colors[v.bg] : 'transparent'),
          borderColor: v.border ? theme.colors[v.border] : 'transparent',
        },
        variant === 'primary' && !inactive && { boxShadow: theme.elevation.low },
        block && styles.block,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={theme.colors[v.fg]} size="small" /> : icon ? <View>{icon}</View> : null}
      <Text variant="bodyStrong" color={v.fg}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  block: { alignSelf: 'stretch' },
  inactive: { opacity: 0.5 },
});
