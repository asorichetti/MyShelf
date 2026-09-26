import { useState } from 'react';
import { Text as RNText, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useLineClamp } from '@/hooks/useLineClamp';
import { useFontScale, useTheme } from '@/theme';

import { Heading, type HeadingLevel } from './Heading';
import { Text } from './Text';

import type { ReactNode } from 'react';

export interface CatalogueCardProps {
  title: string;
  subtitle?: string | null;
  /** Author line, set in Courier Prime like a typed catalogue card. */
  authors?: string | null;
  /** Shown as "ISBN <value>" in Courier Prime. */
  isbn?: string | null;
  /** Typed line above the title, e.g. a call number "FIC PRA 1987". */
  callNumber?: string | null;
  /** Cover slot, left of the text. */
  cover?: ReactNode;
  /** Right-hand slot (e.g. an "On loan" stamp). */
  aside?: ReactNode;
  /** Extra lines under the author (year, series badge). */
  meta?: ReactNode;
  /** Content below the header row. */
  children?: ReactNode;
  /** `row` for list rows, `header` for a book's detail page. */
  size?: 'row' | 'header';
  /** Render the title as a heading at this level; otherwise it is plain text. */
  titleLevel?: HeadingLevel;
  /** Punched hole at the bottom, as on a drawer card (default: header only). */
  hole?: boolean;
  onPress?: () => void;
  /** Long press (e.g. to start selecting books). */
  onLongPress?: () => void;
  /**
   * When set, the card is a checkbox (selection mode) instead of a button,
   * checked or not, and a checked card is highlighted.
   */
  checked?: boolean;
  /** Accessible name when pressable (defaults to the title). */
  accessibilityLabel?: string;
  testID?: string;
  titleTestID?: string;
  authorsTestID?: string;
  callNumberTestID?: string;
  style?: StyleProp<ViewStyle>;
}

const LINE_GAP = 24;
/**
 * The header's text column needs this much room at 100 % text (more at a
 * larger font size); narrower than that, it moves under the cover rather
 * than breaking the title mid-word.
 */
const HEADER_TEXT_MIN_WIDTH = 180;

/** Faint horizontal rules printed on the card stock. Decorative. */
function RuledLines({ height, top }: { height: number; top: number }) {
  const { colors } = useTheme();
  const count = Math.max(0, Math.floor((height - top) / LINE_GAP));
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, styles.noTouch]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.line, { top: top + (i + 1) * LINE_GAP, backgroundColor: colors.cardLine }]} />
      ))}
    </View>
  );
}

/**
 * A library catalogue card for a book: warm card stock with faint ruled
 * lines, a berry header rule, a cover slot, the title in Lora and the author
 * and ISBN typed in Courier Prime.
 */
export function CatalogueCard({
  title,
  subtitle,
  authors,
  isbn,
  callNumber,
  cover,
  aside,
  meta,
  children,
  size = 'row',
  titleLevel,
  hole = size === 'header',
  onPress,
  onLongPress,
  checked,
  accessibilityLabel,
  testID,
  titleTestID,
  authorsTestID,
  callNumberTestID,
  style,
}: CatalogueCardProps) {
  const theme = useTheme();
  const { colors, spacing, radii, typography } = theme;
  const [height, setHeight] = useState(0);
  const header = size === 'header';
  const fontScale = useFontScale();
  const titleLines = useLineClamp(2);
  const titleStyle = header ? typography.h1 : typography.h3;

  const body = (
    <>
      <RuledLines height={height} top={header ? spacing.lg : spacing.sm} />
      <View style={[styles.rule, { backgroundColor: colors.cardRule, marginBottom: header ? spacing.md : spacing.sm }]} />
      <View style={[styles.row, { gap: header ? spacing.lg : spacing.md }, header && styles.wrap]}>
        {cover ? <View>{cover}</View> : null}
        <View style={[styles.text, { gap: spacing.xxs }, header && { minWidth: HEADER_TEXT_MIN_WIDTH * fontScale }]}>
          {callNumber ? (
            <Text variant="stamp" color="accent" testID={callNumberTestID}>
              {callNumber}
            </Text>
          ) : null}
          {titleLevel ? (
            <Heading level={titleLevel} color="ink" testID={titleTestID} style={header ? undefined : typography.h3}>
              {title}
            </Heading>
          ) : (
            <RNText testID={titleTestID} numberOfLines={header ? undefined : titleLines} style={[titleStyle, { color: colors.ink }]}>
              {title}
            </RNText>
          )}
          {subtitle ? (
            <Text color="inkMuted" numberOfLines={header ? undefined : 1} variant={header ? 'body' : 'caption'}>
              {subtitle}
            </Text>
          ) : null}
          {authors ? (
            <Text variant="mono" testID={authorsTestID} numberOfLines={header ? undefined : 1}>
              {authors}
            </Text>
          ) : null}
          {isbn ? (
            <Text variant="mono" color="inkMuted">
              ISBN {isbn}
            </Text>
          ) : null}
          {meta}
        </View>
        {aside ? <View style={styles.aside}>{aside}</View> : null}
      </View>
      {children ? <View style={{ marginTop: spacing.md, gap: spacing.sm }}>{children}</View> : null}
      {hole ? (
        <View
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.hole, { backgroundColor: colors.paper, borderColor: colors.border, marginTop: spacing.md }]}
        />
      ) : null}
    </>
  );

  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: header ? spacing.lg : spacing.md,
      paddingTop: header ? spacing.lg : spacing.md,
      paddingBottom: hole ? spacing.sm : header ? spacing.lg : spacing.md,
      boxShadow: theme.elevation.card,
    },
    style,
  ];
  const onLayout = (e: { nativeEvent: { layout: { height: number } } }) => setHeight(e.nativeEvent.layout.height);

  if (onPress) {
    const selectable = checked !== undefined;
    return (
      <Pressable
        role={selectable ? 'checkbox' : 'button'}
        accessibilityLabel={accessibilityLabel ?? title}
        aria-label={accessibilityLabel ?? title}
        {...(selectable ? { 'aria-checked': checked, accessibilityState: { checked } } : {})}
        onPress={onPress}
        onLongPress={onLongPress}
        onLayout={onLayout}
        testID={testID}
        style={({ pressed }) => [
          cardStyle,
          checked && { backgroundColor: colors.surfaceTint, borderColor: colors.primary, borderWidth: 2 },
          pressed && { backgroundColor: colors.surfaceTint },
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View testID={testID} onLayout={onLayout} style={cardStyle}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  noTouch: { pointerEvents: 'none' },
  line: { position: 'absolute', left: 0, right: 0, height: 1 },
  rule: { height: 2, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  wrap: { flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 0 },
  aside: { alignSelf: 'flex-start' },
  hole: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, alignSelf: 'center' },
});
