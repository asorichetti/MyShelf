import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { MiniSpines } from '@/components/series/MiniSpines';
import { progressSentence } from '@/components/series/seriesText';
import { Heading, Text } from '@/components/ui';
import { formatSeriesPosition, type Book, type SeriesNeighbour, type SeriesNeighbours, type SeriesProgress, type Series } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import type { ReactNode } from 'react';

export interface SeriesSectionProps {
  series: Series;
  position: number | null;
  progress: SeriesProgress;
  neighbours: SeriesNeighbours<Book>;
  /** Books linked to the series (numbered or not). */
  bookCount: number;
  onOpenSeries: () => void;
  onOpenBook: (id: number) => void;
  /** Shown under the heading, e.g. the "Is this Discworld #5?" confirmation. */
  children?: ReactNode;
  testID?: string;
}

/** "Book 5 of 9", "Book 5", or "Not numbered in the series". */
export function placeText(position: number | null, totalCount: number | null): string {
  if (position == null) return 'Not numbered in the series';
  const n = formatSeriesPosition(position);
  return totalCount != null ? `Book ${n} of ${totalCount}` : `Book ${n}`;
}

/** "The Light Fantastic (#2)" or "#3 isn’t on your shelf yet". */
export function neighbourText(n: SeriesNeighbour<Book>): string {
  if (n.kind === 'missing') return `#${formatSeriesPosition(n.position)} isn’t on your shelf yet`;
  const p = n.book.seriesPosition;
  return p != null ? `${n.book.title} (#${formatSeriesPosition(p)})` : n.book.title;
}

function Neighbour({ which, neighbour, onOpenBook, testID }: { which: 'Previous' | 'Next'; neighbour: SeriesNeighbour<Book>; onOpenBook: (id: number) => void; testID: string }) {
  const { colors, spacing, radii, sizes } = useTheme();
  const text = neighbourText(neighbour);
  const icon = which === 'Previous' ? 'chevron-left' : 'chevron-right';
  if (neighbour.kind === 'missing') {
    return (
      <View testID={testID} style={[styles.neighbour, { minHeight: sizes.touchTarget, gap: spacing.sm, paddingHorizontal: spacing.sm }]}>
        <MaterialCommunityIcons name="book-outline" size={sizes.icon} color={colors.inkMuted} aria-hidden />
        <Text color="inkMuted" style={styles.flex}>
          <Text variant="label" color="inkMuted">{`${which}: `}</Text>
          {text}
        </Text>
      </View>
    );
  }
  const book = neighbour.book;
  return (
    <Pressable
      role="link"
      accessibilityLabel={`${which} in the series: ${text}`}
      onPress={() => onOpenBook(book.id)}
      testID={testID}
      style={({ pressed }) => [
        styles.neighbour,
        { minHeight: sizes.touchTarget, gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md },
        pressed && { backgroundColor: colors.surfaceTint },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={sizes.icon} color={colors.primary} aria-hidden />
      <Text style={styles.flex}>
        <Text variant="label" color="inkMuted">{`${which}: `}</Text>
        <Text variant="bodyStrong" color="primary">
          {text}
        </Text>
      </Text>
    </Pressable>
  );
}

/**
 * The book's place in its series on the detail page (P04-06): a link to the
 * series, "Book 5 of 9" with a mini shelf, and the previous and next books
 * (or the number that is missing).
 */
export function SeriesSection({ series, position, progress, neighbours, bookCount, onOpenSeries, onOpenBook, children, testID }: SeriesSectionProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const counts = { name: series.name, owned: progress.owned, total: progress.total, missing: progress.gaps.length, bookCount, totalCount: series.totalCount };
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <Heading level={2}>Series</Heading>
      {children}
      <Pressable
        role="link"
        accessibilityLabel={`${series.name}: see the whole series`}
        onPress={onOpenSeries}
        testID={Testids.bookSeries.link}
        style={({ pressed }) => [
          styles.link,
          {
            minHeight: sizes.touchTarget,
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceTint : colors.surface,
          },
        ]}
      >
        <View style={[styles.flex, { gap: spacing.xs }]}>
          <Text style={[theme.typography.h3, { color: colors.primary }]} numberOfLines={2}>
            {series.name}
          </Text>
          <Text variant="bodyStrong" testID={Testids.bookSeries.place}>
            {placeText(position, series.totalCount)}
          </Text>
          <MiniSpines name={series.name} total={progress.total} gaps={progress.gaps} />
          <Text variant="caption" color="inkMuted">
            {progressSentence(counts)}
          </Text>
        </View>
        <View style={[styles.row, { gap: spacing.xxs }]}>
          <Text variant="label" color="primary">
            See series
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={sizes.icon} color={colors.primary} aria-hidden />
        </View>
      </Pressable>
      {neighbours.previous ? <Neighbour which="Previous" neighbour={neighbours.previous} onOpenBook={onOpenBook} testID={Testids.bookSeries.previous} /> : null}
      {neighbours.next ? <Neighbour which="Next" neighbour={neighbours.next} onOpenBook={onOpenBook} testID={Testids.bookSeries.next} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  neighbour: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
