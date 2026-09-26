import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type ColorRole } from '@/theme';

import { Text } from './Text';

import type { IconName } from './IconButton';

export interface ChipProps {
  label: string;
  /** Selected state for selectable chips (filters, genre choices). */
  selected?: boolean;
  /** Makes the chip a button (or a radio/checkbox, see `role`). */
  onPress?: () => void;
  /** Shows a remove button labelled "Remove <label>" (or `removeLabel`). */
  onRemove?: () => void;
  removeLabel?: string;
  /**
   * Semantics when pressable: `button` (a toggle when `selected` is given),
   * `radio` for one-of-many choices, `checkbox` for many-of-many.
   */
  role?: 'button' | 'radio' | 'checkbox';
  icon?: IconName;
  /** Accessible name for the chip itself (defaults to the label). */
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
  removeTestID?: string;
  style?: StyleProp<ViewStyle>;
}

const PILL_HEIGHT = 36;

/**
 * A rounded label: plain (display only), selectable (radio, checkbox or
 * toggle button) and/or removable. The pill is 36 dp tall, but its buttons
 * reach past it vertically so every touch target is at least 48 x 48
 * (react-native-web ignores hitSlop, so the boxes themselves must be that big).
 */
export function Chip({
  label,
  selected,
  onPress,
  onRemove,
  removeLabel,
  role = 'button',
  icon,
  accessibilityLabel,
  disabled = false,
  testID,
  removeTestID,
  style,
}: ChipProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const [pressed, setPressed] = useState(false);
  const interactive = Boolean(onPress);
  const tone: { bg: ColorRole; fg: ColorRole; border: ColorRole } = selected
    ? { bg: 'primary', fg: 'onPrimary', border: 'primary' }
    : interactive
      ? { bg: 'surface', fg: 'ink', border: 'outline' }
      : { bg: 'primaryContainer', fg: 'onPrimaryContainer', border: 'primaryContainer' };
  const overhang = -(sizes.touchTarget - PILL_HEIGHT) / 2;
  const leading = selected ? 'check' : icon;

  const content = (
    <>
      {leading ? <MaterialCommunityIcons name={leading} size={sizes.icon - 2} color={colors[tone.fg]} /> : null}
      <Text variant="label" color={tone.fg} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </>
  );

  const stateProps =
    selected === undefined
      ? {}
      : role === 'button'
        ? { 'aria-pressed': selected, accessibilityState: { selected, disabled } }
        : { 'aria-checked': selected, accessibilityState: { checked: selected, disabled } };

  return (
    <View testID={interactive ? undefined : testID} style={[styles.outer, { minHeight: sizes.touchTarget }, style]}>
      <View
        style={[
          styles.pill,
          {
            height: PILL_HEIGHT,
            borderRadius: radii.pill,
            backgroundColor: pressed ? colors.surfaceTint : colors[tone.bg],
            borderColor: colors[tone.border],
            paddingLeft: interactive ? 0 : spacing.md,
            paddingRight: onRemove || interactive ? 0 : spacing.md,
            gap: spacing.xs,
          },
          disabled && styles.disabled,
        ]}
      >
        {interactive ? (
          <Pressable
            role={role}
            accessibilityLabel={accessibilityLabel ?? label}
            {...stateProps}
            aria-disabled={disabled}
            disabled={disabled}
            onPress={onPress}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            testID={testID}
            style={[
              styles.inner,
              {
                minHeight: sizes.touchTarget,
                marginVertical: overhang,
                paddingLeft: spacing.md,
                paddingRight: onRemove ? spacing.xxs : spacing.md,
                gap: spacing.xs,
                minWidth: sizes.touchTarget,
              },
            ]}
          >
            {content}
          </Pressable>
        ) : (
          <View style={[styles.inner, { gap: spacing.xs }]} accessibilityLabel={accessibilityLabel}>
            {content}
          </View>
        )}
        {onRemove ? (
          <Pressable
            role="button"
            accessibilityLabel={removeLabel ?? `Remove ${label}`}
            aria-label={removeLabel ?? `Remove ${label}`}
            disabled={disabled}
            onPress={onRemove}
            testID={removeTestID}
            style={({ pressed: p }) => [
              styles.remove,
              {
                width: sizes.touchTarget,
                height: sizes.touchTarget,
                marginVertical: overhang,
                borderRadius: radii.pill,
                backgroundColor: p ? colors.surfaceTint : 'transparent',
              },
            ]}
          >
            <MaterialCommunityIcons name="close-circle" size={sizes.icon} color={colors[tone.fg]} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, overflow: 'visible' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  label: { flexShrink: 1 },
  remove: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
