import { ScrollView, StyleSheet, View } from 'react-native';

import { Spine } from '@/components/book/Spine';
import type { Book } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/** One place on a series shelf: a book you own, or a gap. */
export type SeriesSlot = { kind: 'book'; book: Book } | { kind: 'gap'; position: number };

/**
 * The series in reading order with its gaps in place: numbered books by
 * position (a 2.5 novella between #2 and #3), a gap wherever a whole
 * position is missing, then unnumbered books.
 */
export function seriesSlots(books: readonly Book[], gaps: readonly number[]): SeriesSlot[] {
  const numbered = books.filter((b) => b.seriesPosition != null);
  const loose = books.filter((b) => b.seriesPosition == null);
  const placed: { at: number; order: number; slot: SeriesSlot }[] = [
    ...numbered.map((book, i) => ({ at: book.seriesPosition!, order: i, slot: { kind: 'book' as const, book } })),
    ...gaps.map((position) => ({ at: position, order: -1, slot: { kind: 'gap' as const, position } })),
  ];
  placed.sort((a, b) => a.at - b.at || a.order - b.order);
  return [...placed.map((p) => p.slot), ...loose.map((book) => ({ kind: 'book' as const, book }))];
}

export interface SeriesShelfProps {
  slots: readonly SeriesSlot[];
}

/**
 * The series as spines on a brass-edged shelf, gaps as dashed outlines
 * labelled "#2 missing". Scrolls sideways when the series is long. It is a
 * picture of the list below it, so assistive tech skips it.
 */
export function SeriesShelf({ slots }: SeriesShelfProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={Testids.seriesDetail.shelf}
      style={[styles.frame, { backgroundColor: colors.surfaceTint, borderRadius: radii.md, borderColor: colors.border }]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.lg }]}>
        {slots.map((slot) =>
          slot.kind === 'book' ? (
            <Spine key={`b${slot.book.id}`} title={slot.book.title} position={slot.book.seriesPosition} testID={Testids.seriesDetail.spine} />
          ) : (
            <Spine key={`g${slot.position}`} variant="missing" position={slot.position} testID={Testids.seriesDetail.gap} />
          ),
        )}
      </ScrollView>
      {/* The shelf board: brass edge with a soft shadow under it. */}
      <View style={[styles.board, { backgroundColor: colors.brass, boxShadow: theme.elevation.card, borderBottomLeftRadius: radii.md, borderBottomRightRadius: radii.md }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-end', flexGrow: 1 },
  board: { height: 10 },
});
