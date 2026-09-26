import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { Button, Text } from '@/components/ui';
import { formatSeriesPosition, type Book } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useFontScale, useTheme } from '@/theme';

import type { SeriesSlot } from './SeriesShelf';

export interface SeriesBookListProps {
  seriesName: string;
  slots: readonly SeriesSlot[];
  onOpenBook: (id: number) => void;
  onAddGap: (position: number) => void;
}

const numberLabel = (book: Book) => (book.seriesPosition != null ? t('series.number', { position: formatSeriesPosition(book.seriesPosition) }) : t('series.bookList.unnumbered'));

/** "#1, The Colour of Magic, 1983": what a screen reader says for a book in the series. */
export function seriesBookLabel(book: Book): string {
  const number = book.seriesPosition != null ? t('series.bookList.numberLabel', { position: formatSeriesPosition(book.seriesPosition) }) : t('series.bookList.notNumbered');
  return book.publicationYear != null
    ? t('series.bookList.bookLabelWithYear', { number, title: book.title, year: String(book.publicationYear) })
    : t('series.bookList.bookLabel', { number, title: book.title });
}

/**
 * The series in reading order as a list: each book with its real cover (or
 * the generated one) and number, and each gap as a dashed "#3 missing" card
 * with "Add #3".
 */
export function SeriesBookList({ seriesName, slots, onOpenBook, onAddGap }: SeriesBookListProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const fontScale = useFontScale();
  return (
    <View role="list" aria-label={t('series.bookList.label', { name: seriesName })} style={{ gap: spacing.sm }}>
      {slots.map((slot) =>
        slot.kind === 'book' ? (
          <View role="listitem" key={`b${slot.book.id}`}>
            <Pressable
              role="link"
              accessibilityLabel={seriesBookLabel(slot.book)}
              onPress={() => onOpenBook(slot.book.id)}
              testID={Testids.seriesDetail.book}
              style={({ pressed }) => [
                styles.row,
                {
                  gap: spacing.md,
                  padding: spacing.sm,
                  minHeight: sizes.touchTarget,
                  borderRadius: radii.md,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceTint : colors.surface,
                },
              ]}
            >
              <Text variant="mono" color="accent" style={[styles.number, { minWidth: spacing.xxxl }]}>
                {numberLabel(slot.book)}
              </Text>
              <CoverImage uri={slot.book.coverUri} title={slot.book.title} size="thumb" />
              <View style={[styles.flex, { gap: spacing.xxs }]}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {slot.book.title}
                </Text>
                {slot.book.publicationYear != null ? (
                  <Text variant="mono" color="inkMuted">
                    {slot.book.publicationYear}
                  </Text>
                ) : null}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={sizes.icon + 4} color={colors.inkMuted} aria-hidden />
            </Pressable>
          </View>
        ) : (
          <View
            role="listitem"
            key={`g${slot.position}`}
            style={[
              styles.row,
              styles.gap,
              { gap: spacing.md, padding: spacing.sm, borderRadius: radii.md, borderColor: colors.outline, backgroundColor: colors.surfaceTint },
            ]}
          >
            <Text variant="mono" color="inkMuted" style={[styles.number, { minWidth: spacing.xxxl }]}>
              {t('series.number', { position: formatSeriesPosition(slot.position) })}
            </Text>
            <Text color="inkMuted" style={[styles.missing, { flexBasis: 100 * fontScale }]}>{t('series.bookList.gapMissing', { position: formatSeriesPosition(slot.position) })}</Text>
            <Button
              variant="secondary"
              label={t('series.bookList.addGap', { position: formatSeriesPosition(slot.position) })}
              accessibilityLabel={t('series.bookList.addGapLabel', { position: formatSeriesPosition(slot.position), name: seriesName })}
              icon={<MaterialCommunityIcons name="plus" size={sizes.icon} color={colors.onPrimaryContainer} />}
              onPress={() => onAddGap(slot.position)}
              testID={Testids.seriesDetail.addGap}
              style={{ paddingHorizontal: spacing.lg }}
            />
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  // At a large font size the Add button moves under the words rather than squeezing them.
  gap: { borderStyle: 'dashed', borderWidth: 1.5, flexWrap: 'wrap' },
  missing: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  number: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
