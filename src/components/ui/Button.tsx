import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ColorRole } from '@/theme';

import { Text } from './Text';

import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

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
  /** For buttons that open and close something (a menu, a panel). */
  expanded?: boolean;
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
  /** Destructive actions (delete, discard). */
  danger: { bg: 'danger', bgPressed: 'onDangerContainer', fg: 'onDanger', border: null },
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
  expanded,
}: ButtonProps) {
  const theme = useTheme();
  const v = variantColors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading, expanded }}
      aria-disabled={inactive}
      aria-expanded={expanded}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: theme.sizes.touchTarget,
          // xl is half the 48 dp height: a pill on one line, a rounded box when a large font wraps the label.
          borderRadius: theme.radii.xl,
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.xs,
          gap: theme.spacing.sm,
          backgroundColor: (pressed && v.bgPressed ? theme.colors[v.bgPressed] : v.bg ? theme.colors[v.bg] : 'transparent'),
          borderColor: v.border ? theme.colors[v.border] : 'transparent',
        },
        (variant === 'primary' || variant === 'danger') && !inactive && { boxShadow: theme.elevation.low },
        block && styles.block,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={theme.colors[v.fg]} size="small" /> : icon ? <View>{icon}</View> : null}
      <Text variant="bodyStrong" color={v.fg} align="center" style={styles.label}>
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
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
  block: { alignSelf: 'stretch' },
  inactive: { opacity: 0.5 },
});
