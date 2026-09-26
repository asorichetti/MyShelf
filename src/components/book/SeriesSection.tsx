import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { MiniSpines } from '@/components/series/MiniSpines';
import { progressSentence } from '@/components/series/seriesText';
import { Heading, Text } from '@/components/ui';
import { formatSeriesPosition, type Book, type SeriesNeighbour, type SeriesNeighbours, type SeriesProgress, type Series } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useFontScale, useTheme } from '@/theme';

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
  if (position == null) return t('book.seriesSection.notNumbered');
  const n = formatSeriesPosition(position);
  return totalCount != null ? t('book.seriesSection.placeOf', { position: n, total: totalCount }) : t('book.seriesSection.place', { position: n });
}

/** "The Light Fantastic (#2)" or "#3 isn’t on your shelf yet". */
export function neighbourText(n: SeriesNeighbour<Book>): string {
  if (n.kind === 'missing') return t('book.seriesSection.missing', { position: formatSeriesPosition(n.position) });
  const p = n.book.seriesPosition;
  return p != null ? t('book.seriesSection.neighbour', { title: n.book.title, position: formatSeriesPosition(p) }) : n.book.title;
}

function Neighbour({ which, neighbour, onOpenBook, testID }: { which: 'previous' | 'next'; neighbour: SeriesNeighbour<Book>; onOpenBook: (id: number) => void; testID: string }) {
  const { colors, spacing, radii, sizes } = useTheme();
  const text = neighbourText(neighbour);
  const icon = which === 'previous' ? 'chevron-left' : 'chevron-right';
  const prefix = which === 'previous' ? t('book.seriesSection.previous') : t('book.seriesSection.next');
  if (neighbour.kind === 'missing') {
    return (
      <View testID={testID} style={[styles.neighbour, { minHeight: sizes.touchTarget, gap: spacing.sm, paddingHorizontal: spacing.sm }]}>
        <MaterialCommunityIcons name="book-outline" size={sizes.icon} color={colors.inkMuted} aria-hidden />
        <Text color="inkMuted" style={styles.flex}>
          <Text variant="label" color="inkMuted">{prefix}</Text>
          {text}
        </Text>
      </View>
    );
  }
  const book = neighbour.book;
  return (
    <Pressable
      role="link"
      accessibilityLabel={which === 'previous' ? t('book.seriesSection.previousLink', { book: text }) : t('book.seriesSection.nextLink', { book: text })}
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
        <Text variant="label" color="inkMuted">{prefix}</Text>
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
  const fontScale = useFontScale();
  const counts = { name: series.name, owned: progress.owned, total: progress.total, missing: progress.gaps.length, bookCount, totalCount: series.totalCount };
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <Heading level={2}>{t('bookFields.series')}</Heading>
      {children}
      <Pressable
        role="link"
        accessibilityLabel={t('book.seriesSection.seriesLink', { name: series.name })}
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
        <View style={[styles.summary, { gap: spacing.xs, flexBasis: 160 * fontScale }]}>
          <Text style={[theme.typography.h3, { color: colors.primary }]}>
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
            {t('book.seriesSection.seeSeries')}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={sizes.icon} color={colors.primary} aria-hidden />
        </View>
      </Pressable>
      {neighbours.previous ? <Neighbour which="previous" neighbour={neighbours.previous} onOpenBook={onOpenBook} testID={Testids.bookSeries.previous} /> : null}
      {neighbours.next ? <Neighbour which="next" neighbour={neighbours.next} onOpenBook={onOpenBook} testID={Testids.bookSeries.next} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // "See series" moves under the summary when a large font leaves no room beside it.
  link: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderWidth: 1 },
  summary: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  neighbour: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
