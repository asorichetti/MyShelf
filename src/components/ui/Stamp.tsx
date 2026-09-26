import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type StampTone = 'warn' | 'danger' | 'success' | 'accent';

export interface StampProps {
  /** Stamp text; shown in upper case. */
  label: string;
  tone?: StampTone;
  /** Tilt in degrees, like a hand-inked rubber stamp. */
  rotate?: number;
  /** Full description for screen readers when the label is terse ("DUE 12 OCT"). */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A library rubber stamp: typewriter capitals in a double-ruled box, tilted a
 * few degrees. The ink is the tone colour on card stock (`surface`), a pair
 * that meets WCAG AA for every tone.
 */
export function Stamp({ label, tone = 'accent', rotate = -4, accessibilityLabel, testID, style }: StampProps) {
  const { colors, spacing, radii } = useTheme();
  const ink = colors[tone];
  return (
    <View
      testID={testID}
      {...(accessibilityLabel ? { accessible: true, role: 'img' as const, accessibilityLabel, 'aria-label': accessibilityLabel } : {})}
      style={[
        styles.outer,
        {
          borderColor: ink,
          borderRadius: radii.sm,
          backgroundColor: colors.surface,
          padding: spacing.xxs,
          transform: [{ rotate: `${rotate}deg` }],
        },
        style,
      ]}
    >
      <View style={[styles.inner, { borderColor: ink, borderRadius: radii.sm - 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs }]}>
        <Text variant="stamp" color={tone}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Narrower than its column, tilt included: a long stamp at a large font size wraps instead.
  outer: { borderWidth: 2, alignSelf: 'flex-start', maxWidth: '94%' },
  inner: { borderWidth: 1 },
});
