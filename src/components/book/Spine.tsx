import { StyleSheet, Text as RNText, View } from 'react-native';

import { formatSeriesPosition, hashColour, hashString } from '@/domain';
import { useTheme } from '@/theme';

export type SpineSize = 'mini' | 'shelf';

export interface SpineProps {
  /** The book's title (names the spine and picks its cloth colour); ignored for a missing spine. */
  title?: string;
  /** Series position, printed on a label at the foot of the spine. */
  position?: number | null;
  /** `missing` draws a dashed outline for a gap in the series. */
  variant?: 'owned' | 'missing';
  size?: SpineSize;
  /** Picks the cloth colour when there is no title (mini spines). */
  colourKey?: string;
  testID?: string;
}

const DIMENSIONS: Record<SpineSize, { width: number; height: number }> = {
  mini: { width: 10, height: 28 },
  shelf: { width: 44, height: 172 },
};

/** Height varies a little per book, like a real shelf (0 to 14% shorter). */
export function spineHeight(size: SpineSize, key: string): number {
  const { height } = DIMENSIONS[size];
  return size === 'mini' ? height : Math.round(height * (1 - (hashString(key) % 15) / 100));
}

/**
 * A book standing on a shelf, seen from its spine: a cloth binding in the
 * generated-cover palette (by a hash of the title), brass bands, the title
 * running up the spine and the series number on a paper label. A missing
 * book is a dashed outline with its number. Always decorative: the screen
 * lists the same books as text.
 */
export function Spine({ title = '', position = null, variant = 'owned', size = 'shelf', colourKey, testID }: SpineProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const key = colourKey ?? title;
  const width = DIMENSIONS[size].width;
  const height = spineHeight(size, variant === 'missing' ? `missing-${position ?? ''}` : key);
  const label = position != null ? `#${formatSeriesPosition(position)}` : null;
  const hidden = { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  if (variant === 'missing') {
    return (
      <View
        {...hidden}
        testID={testID}
        style={[
          styles.spine,
          {
            width,
            height,
            borderRadius: size === 'mini' ? 2 : radii.sm,
            borderColor: colors.outline,
            borderWidth: size === 'mini' ? 1 : 1.5,
            borderStyle: 'dashed',
            backgroundColor: colors.surfaceTint,
            justifyContent: 'center',
          },
        ]}
      >
        {size === 'shelf' && label ? (
          <View style={[styles.center, { gap: spacing.xxs }]}>
            <RNText style={[theme.typography.label, { color: colors.inkMuted }]}>{label}</RNText>
            <RNText style={[theme.typography.tabLabel, styles.vertical, { color: colors.inkMuted }]}>missing</RNText>
          </View>
        ) : null}
      </View>
    );
  }

  const cloth = theme.covers[hashColour(key, theme.covers.length)];
  return (
    <View {...hidden} testID={testID} style={[styles.spine, { width, height, backgroundColor: cloth.cloth, borderRadius: size === 'mini' ? 2 : radii.sm }]}>
      {size === 'shelf' ? (
        <>
          <View style={[styles.band, { top: spacing.sm, backgroundColor: cloth.trim }]} />
          <View style={[styles.band, { top: spacing.sm + 5, backgroundColor: cloth.trim, opacity: 0.6 }]} />
          {/* The title runs up the spine: a horizontal line of text, turned a quarter. */}
          <View style={[styles.titleBox, { width: height - 64, left: (width - (height - 64)) / 2, top: height / 2 - 12 - spacing.sm }]}>
            <RNText numberOfLines={1} style={[theme.typography.caption, styles.title, { color: cloth.ink, fontFamily: theme.fonts.heading }]}>
              {title}
            </RNText>
          </View>
          {label ? (
            <View style={[styles.label, { bottom: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.sm - 3, paddingHorizontal: spacing.xxs }]}>
              <RNText numberOfLines={1} style={[theme.typography.tabLabel, { color: colors.ink, fontFamily: theme.fonts.monoBold }]}>
                {label}
              </RNText>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  spine: { overflow: 'hidden', alignItems: 'center' },
  center: { alignItems: 'center' },
  vertical: { textAlign: 'center' },
  band: { position: 'absolute', left: 0, right: 0, height: 2 },
  titleBox: { position: 'absolute', height: 24, justifyContent: 'center', transform: [{ rotate: '-90deg' }] },
  title: { textAlign: 'center' },
  label: { position: 'absolute', alignSelf: 'center', minWidth: 26, alignItems: 'center' },
});
