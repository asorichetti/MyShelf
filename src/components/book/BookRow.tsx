import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { shelfLoanLabel } from '@/components/loans/ShelfLoanStamp';
import { CatalogueCard, StarRatingDisplay, Text } from '@/components/ui';
import { formatSeriesLabel, joinNames, ratedPhrase, today as todayOf, type BookListItem } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { CoverImage } from './CoverImage';

/**
 * "Mort, by Terry Pratchett, 1987" (+ ", rated 4 out of 5", + ", on loan to
 * Sam"): what a screen reader says for a row, a cover or a spine.
 */
export function bookRowLabel(
  item: Pick<BookListItem, 'title' | 'authors' | 'publicationYear' | 'onLoan' | 'loanBorrower' | 'loanDueOn' | 'rating'>,
  today: string = todayOf(),
): string {
  let label = item.authors.length ? t('bookList.row.withAuthors', { title: item.title, authors: joinNames(item.authors) }) : item.title;
  if (item.publicationYear != null) label = t('bookList.row.withYear', { label, year: item.publicationYear });
  const rated = ratedPhrase(item.rating);
  if (rated) label = t('bookList.row.withRating', { label, rated });
  const loan = shelfLoanLabel(item, today);
  if (loan) label = t('bookList.row.withLoan', { label, loan });
  return label;
}

export interface BookRowProps {
  item: BookListItem;
  onPress: (id: number) => void;
  /** Long press, e.g. to start selecting books. */
  onLongPress?: (id: number) => void;
  /** Set while the Shelf is selecting: the row becomes a checkbox, checked or not. */
  selected?: boolean;
  /** Extra badges shown with the year and series (e.g. a loan badge). */
  badges?: ReactNode;
}

/**
 * One book on the Shelf, as a compact catalogue card: cover thumbnail, title
 * in Lora, author and year typed in Courier Prime, the reader's stars, a
 * series badge and any `badges` (the Shelf passes the loan stamp).
 */
export const BookRow = memo(function BookRow({ item, onPress, onLongPress, selected, badges }: BookRowProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const author = joinNames(item.authors);
  const series = item.seriesName ? formatSeriesLabel(item.seriesName, item.seriesPosition) : null;
  return (
    <CatalogueCard
      testID={Testids.home.row}
      title={item.title}
      authors={author || null}
      cover={
        <View>
          <CoverImage uri={item.coverUri} title={item.title} author={author} size="thumb" />
          {selected !== undefined ? (
            <View
              testID={Testids.selection.checkbox}
              style={[styles.check, { top: -spacing.xs, left: -spacing.xs, backgroundColor: selected ? colors.primary : colors.surface, borderColor: colors.primary, borderRadius: radii.pill }]}
            >
              <MaterialCommunityIcons name={selected ? 'check' : 'checkbox-blank-circle-outline'} size={sizes.icon} color={selected ? colors.onPrimary : colors.primary} />
            </View>
          ) : null}
        </View>
      }
      onPress={() => onPress(item.id)}
      onLongPress={onLongPress ? () => onLongPress(item.id) : undefined}
      checked={selected}
      accessibilityLabel={bookRowLabel(item)}
      meta={
        item.publicationYear != null || series || item.rating != null || badges ? (
          <View style={[styles.meta, { gap: spacing.sm, marginTop: spacing.xxs }]}>
            {item.publicationYear != null ? (
              <Text variant="mono" color="inkMuted">
                {item.publicationYear}
              </Text>
            ) : null}
            <StarRatingDisplay value={item.rating} />
            {series ? (
              <View style={[styles.badge, { backgroundColor: colors.primaryContainer, borderRadius: radii.pill, paddingHorizontal: spacing.sm }]}>
                <Text variant="caption" color="onPrimaryContainer" numberOfLines={1}>
                  {series}
                </Text>
              </View>
            ) : null}
            {badges}
          </View>
        ) : null
      }
    />
  );
});

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  badge: { flexShrink: 1 },
  check: { position: 'absolute', borderWidth: 1.5, padding: 1 },
});
