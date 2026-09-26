import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CatalogueCard, Stamp, Text } from '@/components/ui';
import { joinNames, seriesLabel, type BookListItem } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { CoverImage } from './CoverImage';

/** "Mort, by Terry Pratchett, 1987" (+ ", on loan"): what a screen reader says for a row. */
export function bookRowLabel(item: Pick<BookListItem, 'title' | 'authors' | 'publicationYear' | 'onLoan'>): string {
  const parts = [item.title];
  if (item.authors.length) parts.push(`by ${joinNames(item.authors)}`);
  if (item.publicationYear != null) parts.push(String(item.publicationYear));
  if (item.onLoan) parts.push('on loan');
  return parts.join(', ');
}

export interface BookRowProps {
  item: BookListItem;
  onPress: (id: number) => void;
}

/**
 * One book on the Shelf, as a compact catalogue card: cover thumbnail, title
 * in Lora, author and year typed in Courier Prime, a series badge and an
 * "On loan" stamp.
 */
export const BookRow = memo(function BookRow({ item, onPress }: BookRowProps) {
  const { colors, spacing, radii } = useTheme();
  const author = joinNames(item.authors);
  const series = item.seriesName ? seriesLabel(item.seriesName, item.seriesPosition) : null;
  return (
    <CatalogueCard
      testID={Testids.home.row}
      title={item.title}
      authors={author || null}
      cover={<CoverImage uri={item.coverUri} title={item.title} author={author} size="thumb" />}
      aside={item.onLoan ? <Stamp label="On loan" tone="accent" rotate={-6} /> : undefined}
      onPress={() => onPress(item.id)}
      accessibilityLabel={bookRowLabel(item)}
      meta={
        item.publicationYear != null || series ? (
          <View style={[styles.meta, { gap: spacing.sm, marginTop: spacing.xxs }]}>
            {item.publicationYear != null ? (
              <Text variant="mono" color="inkMuted">
                {item.publicationYear}
              </Text>
            ) : null}
            {series ? (
              <View style={[styles.badge, { backgroundColor: colors.primaryContainer, borderRadius: radii.pill, paddingHorizontal: spacing.sm }]}>
                <Text variant="caption" color="onPrimaryContainer" numberOfLines={1}>
                  {series}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null
      }
    />
  );
});

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  badge: { flexShrink: 1 },
});
