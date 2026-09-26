import { Text as RNText, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { hashColour, sortableTitle } from '@/domain';
import { useTheme, type CoverSize } from '@/theme';

export interface GeneratedCoverProps {
  title: string;
  author?: string | null;
  size?: CoverSize;
  testID?: string;
}

/**
 * A cloth-bound cover drawn in theme colours when a book has no cover image:
 * the binding colour comes from a stable hash of the title, with brass rules
 * and a spine hinge, and the title and author set in Lora. Always decorative:
 * whoever places it names the book in adjacent text.
 */
export function GeneratedCover({ title, author, size = 'thumb', testID }: GeneratedCoverProps) {
  const theme = useTheme();
  const { width, height } = theme.coverSizes[size];
  const colors = theme.covers[hashColour(title, theme.covers.length)];
  const thumb = size === 'thumb';
  const inset = thumb ? 5 : size === 'medium' ? 10 : 16;
  const titleType = size === 'large' ? theme.typography.h2 : theme.typography.h3;
  const initial = sortableTitle(title).charAt(0).toUpperCase();

  return (
    <View
      testID={testID}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.cover, { width, height, backgroundColor: colors.cloth, borderRadius: theme.radii.sm }]}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Spine hinge */}
        <Rect x={0} y={0} width={inset * 0.8} height={height} fill={colors.ink} opacity={0.12} />
        <Line x1={inset} y1={0} x2={inset} y2={height} stroke={colors.trim} strokeWidth={1} opacity={0.6} />
        {/* Brass rules top and bottom */}
        <Line x1={inset * 1.6} y1={inset * 1.4} x2={width - inset} y2={inset * 1.4} stroke={colors.trim} strokeWidth={thumb ? 1 : 2} />
        <Line x1={inset * 1.6} y1={inset * 1.4 + 3} x2={width - inset} y2={inset * 1.4 + 3} stroke={colors.trim} strokeWidth={1} />
        <Line x1={inset * 1.6} y1={height - inset * 1.4} x2={width - inset} y2={height - inset * 1.4} stroke={colors.trim} strokeWidth={thumb ? 1 : 2} />
        <Line x1={inset * 1.6} y1={height - inset * 1.4 - 3} x2={width - inset} y2={height - inset * 1.4 - 3} stroke={colors.trim} strokeWidth={1} />
      </Svg>
      {thumb ? (
        <RNText style={[theme.typography.h2, styles.center, { color: colors.ink }]}>{initial}</RNText>
      ) : (
        <View style={[styles.text, { paddingLeft: inset * 1.8, paddingRight: inset, gap: theme.spacing.sm }]}>
          <RNText numberOfLines={size === 'large' ? 6 : 5} style={[titleType, styles.center, { color: colors.ink }]}>
            {title}
          </RNText>
          {author ? (
            <RNText numberOfLines={2} style={[theme.typography.caption, styles.center, { color: colors.ink, fontFamily: theme.fonts.headingRegular }]}>
              {author}
            </RNText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
