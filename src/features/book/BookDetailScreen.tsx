import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookHeader } from '@/components/book/BookHeader';
import { GenreChips } from '@/components/book/GenreChips';
import { SummaryText } from '@/components/book/SummaryText';
import { Booky } from '@/components/booky';
import { ConfirmDialog, EmptyState, Heading, IconButton, Menu, Screen, Stamp, Text, useSnackbar } from '@/components/ui';
import { daysOverdue, formatDate, formatSeriesPosition, loanStatus, today, type BookDetail } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { parseBookId, useBook } from './useBook';
import { useDeleteBook } from './useDeleteBook';

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
  const status = loanStatus(loan, now);
  const dueShort = loan.dueOn ? `Due ${formatDate(loan.dueOn).replace(/ \d{4}$/, '')}` : null;
  const stamp =
    status === 'overdue'
      ? { label: 'Overdue', tone: 'danger' as const }
      : { label: dueShort ?? 'On loan', tone: status === 'due-soon' ? ('warn' as const) : ('accent' as const) };
  const overdueDays = daysOverdue(loan, now);
  const due = !loan.dueOn
    ? ''
    : status === 'overdue'
      ? ` It was due back on ${formatDate(loan.dueOn)} (${overdueDays === 1 ? '1 day' : `${overdueDays} days`} ago).`
      : ` Due back on ${formatDate(loan.dueOn)}.`;
  return (
    <View style={[styles.loan, { gap: spacing.md }]}>
      <Stamp label={stamp.label} tone={stamp.tone} />
      <Text style={styles.flex}>{`Lent to ${loan.borrowerName} on ${formatDate(loan.lentOn)}.${due}`}</Text>
    </View>
  );
}

function BookDetailContent({ book }: { book: BookDetail }) {
  const { spacing } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteBook = useDeleteBook();
  const { show } = useSnackbar();

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteBook({ id: book.id, title: book.title });
      setConfirming(false);
      goBackOrShelf();
    } catch (e) {
      console.error('Could not delete the book', e);
      setDeleting(false);
      setConfirming(false);
      show({ message: 'Sorry, I couldn’t remove that book. Please try again.' });
    }
  };

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
        <IconButton
          icon="dots-vertical"
          accessibilityLabel="More actions"
          expanded={menuOpen}
          onPress={() => setMenuOpen(true)}
          testID={Testids.bookDetail.more}
        />
      </View>
      <Menu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        accessibilityLabel={`More actions for ${book.title}`}
        testID={Testids.menu.root}
        items={[{ label: 'Delete book', icon: 'trash-can-outline', destructive: true, onPress: () => setConfirming(true), testID: Testids.bookDetail.delete }]}
      />
      <ConfirmDialog
        visible={confirming}
        illustration={<Booky expression="concerned" size={72} animated={false} />}
        title="Remove this book?"
        message={`Remove “${book.title}” from your shelf? Loan history for it will be removed too.`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      >
        {book.openLoan ? (
          <View style={[styles.warning, { gap: spacing.sm }]}>
            <Stamp label="On loan" tone="warn" rotate={-3} />
            <Text style={styles.flex}>{`It’s on loan to ${book.openLoan.borrowerName} right now, and that loan will be forgotten too.`}</Text>
          </View>
        ) : null}
      </ConfirmDialog>
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
  warning: { flexDirection: 'row', alignItems: 'center' },
});
