import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ColorRole } from '@/theme';

import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type IconButtonVariant = 'plain' | 'tonal' | 'filled' | 'danger';

export interface IconButtonProps {
  icon: IconName;
  /** Required: an icon has no visible text, so this is the button's only name. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  disabled?: boolean;
  /** For disclosure buttons (menus, "more options"): whether the thing it controls is open. */
  expanded?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const variantColors: Record<IconButtonVariant, { bg: ColorRole | null; fg: ColorRole; pressed: ColorRole }> = {
  plain: { bg: null, fg: 'primary', pressed: 'surfaceTint' },
  tonal: { bg: 'primaryContainer', fg: 'onPrimaryContainer', pressed: 'surfaceTint' },
  filled: { bg: 'primary', fg: 'onPrimary', pressed: 'onPrimaryContainer' },
  danger: { bg: null, fg: 'danger', pressed: 'dangerContainer' },
};

/** An icon-only button with a 48 dp touch target and a required accessible name. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  disabled = false,
  expanded,
  accessibilityHint,
  testID,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const v = variantColors[variant];
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, expanded }}
      aria-disabled={disabled}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          width: theme.sizes.touchTarget,
          height: theme.sizes.touchTarget,
          borderRadius: theme.radii.pill,
          backgroundColor: pressed ? theme.colors[v.pressed] : v.bg ? theme.colors[v.bg] : 'transparent',
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={theme.sizes.icon + 4} color={theme.colors[v.fg]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
