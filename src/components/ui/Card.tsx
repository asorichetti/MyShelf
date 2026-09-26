import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Heading, type HeadingLevel } from './Heading';
import { Text } from './Text';

import type { ReactNode } from 'react';

export interface CardProps {
  children?: ReactNode;
  title?: string;
  /** Small caption above the title, like a catalogue call number. */
  eyebrow?: string;
  titleLevel?: Exclude<HeadingLevel, 1>;
  onPress?: () => void;
  /** Accessible name when the card is pressable (defaults to the title). */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A library catalogue card: warm card stock, a red-violet ruled header line
 * and the punched hole at the bottom that held it on the drawer rod.
 */
export function Card({ children, title, eyebrow, titleLevel = 2, onPress, accessibilityLabel, testID, style }: CardProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const body = (
    <>
      {(title || eyebrow) && (
        <View style={[styles.header, { borderBottomColor: colors.cardRule, paddingBottom: spacing.sm, marginBottom: spacing.md }]}>
          {eyebrow ? (
            <Text variant="stamp" color="accent">
              {eyebrow}
            </Text>
          ) : null}
          {title ? <Heading level={titleLevel}>{title}</Heading> : null}
        </View>
      )}
      {children}
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.hole, { backgroundColor: colors.paper, borderColor: colors.border, marginTop: spacing.md }]}
      />
    </>
  );
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.lg,
      paddingBottom: spacing.sm,
      boxShadow: theme.elevation.card,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        role="button"
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [cardStyle, pressed && { backgroundColor: colors.surfaceTint }]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={cardStyle}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  header: { borderBottomWidth: 2, gap: 2 },
  hole: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, alignSelf: 'center' },
});
