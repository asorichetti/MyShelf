import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BookHeader } from '@/components/book/BookHeader';
import { GenreChips } from '@/components/book/GenreChips';
import { SummaryText } from '@/components/book/SummaryText';
import { Booky } from '@/components/booky';
import { EmptyState, Heading, IconButton, Screen, Stamp, Text } from '@/components/ui';
import { daysBetween, formatDate, formatSeriesPosition, isOverdue, today, type BookDetail } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { parseBookId, useBook } from './useBook';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

/** Back to wherever the user came from, or the Shelf when the page was opened directly. */
export function goBackOrShelf() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function Section({ title, children, testID }: { title: string; children: React.ReactNode; testID?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <Heading level={2}>{title}</Heading>
      {children}
    </View>
  );
}

function LoanStatus({ loan }: { loan: NonNullable<BookDetail['openLoan']> }) {
  const { spacing } = useTheme();
  const now = today();
  const overdue = isOverdue(loan, now);
  const stamp = overdue
    ? { label: 'Overdue', tone: 'danger' as const }
    : loan.dueOn
      ? { label: `Due ${formatDate(loan.dueOn).replace(/ \d{4}$/, '')}`, tone: 'warn' as const }
      : { label: 'On loan', tone: 'accent' as const };
  const due = loan.dueOn
    ? overdue
      ? ` It was due back on ${formatDate(loan.dueOn)} (${daysBetween(loan.dueOn, now)} days ago).`
      : ` Due back on ${formatDate(loan.dueOn)}.`
    : '';
  return (
    <View style={[styles.loan, { gap: spacing.md }]}>
      <Stamp label={stamp.label} tone={stamp.tone} />
      <Text style={styles.flex}>{`Lent to ${loan.borrowerName} on ${formatDate(loan.lentOn)}.${due}`}</Text>
    </View>
  );
}

function BookDetailContent({ book }: { book: BookDetail }) {
  const { spacing } = useTheme();
  return (
    <Screen testID={Testids.bookDetail.root} edges={[...EDGES]}>
      <View style={[styles.bar, { gap: spacing.xs, marginTop: -spacing.sm, marginHorizontal: -spacing.sm }]}>
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={goBackOrShelf} testID={Testids.bookDetail.back} />
        <View style={styles.flex} />
        <IconButton
          icon="pencil-outline"
          variant="tonal"
          accessibilityLabel={`Edit ${book.title}`}
          onPress={() => router.navigate({ pathname: '/book/[id]/edit', params: { id: String(book.id) } })}
          testID={Testids.bookDetail.edit}
        />
      </View>
      <BookHeader book={book} />
      {book.summary ? (
        <Section title="Summary">
          <SummaryText text={book.summary} testID={Testids.bookDetail.summary} readMoreTestID={Testids.bookDetail.readMore} />
        </Section>
      ) : null}
      {book.genres.length ? (
        <Section title="Genres">
          <GenreChips genres={book.genres.map((g) => g.name)} testID={Testids.bookDetail.genres} />
        </Section>
      ) : null}
      {book.series ? (
        <Section title="Series">
          <Text testID={Testids.bookDetail.series}>
            {book.seriesPosition != null ? `${book.series.name} · #${formatSeriesPosition(book.seriesPosition)}` : book.series.name}
          </Text>
        </Section>
      ) : null}
      {book.notes ? (
        <Section title="Notes">
          <Text testID={Testids.bookDetail.notes} selectable>
            {book.notes}
          </Text>
        </Section>
      ) : null}
      <Section title="Loan" testID={Testids.bookDetail.loan}>
        {book.openLoan ? <LoanStatus loan={book.openLoan} /> : <Text color="inkMuted">On the shelf, not lent to anyone.</Text>}
      </Section>
    </Screen>
  );
}

/** Shown for an id that is not in the catalogue (deleted, or a mistyped link). */
export function BookMissing() {
  return (
    <Screen pageState="error" testID={Testids.bookMissing.root} centered edges={[...EDGES]}>
      <EmptyState
        illustration={<Booky expression="concerned" size={120} />}
        headingLevel={1}
        title="Book not found"
        titleTestID={Testids.bookMissing.title}
        message="I looked on every shelf, but that book isn't in your catalogue. It may have been removed."
        action={{ label: 'Back to shelf', onPress: () => router.replace('/'), testID: Testids.bookMissing.back }}
      />
    </Screen>
  );
}

/** `/book/[id]`: a book's catalogue card, summary, genres, series, notes and loan status. */
export function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useBook(parseBookId(id));
  if (state.status === 'missing') return <BookMissing />;
  if (state.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <Text color="inkMuted" align="center">
          Fetching the card from the drawer…
        </Text>
      </Screen>
    );
  }
  return <BookDetailContent book={state.book} />;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  loan: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
