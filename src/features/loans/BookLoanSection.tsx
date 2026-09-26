import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { BookLoanHistory } from '@/components/loans/BookLoanHistory';
import { LendSheet, type LendSubmitResult, type LendValues } from '@/components/loans/LendSheet';
import { LoanStamp } from '@/components/loans/LoanStamp';
import { Button, Stamp, Text, useSnackbar } from '@/components/ui';
import { loansRepo, useDatabase } from '@/db';
import { dayCount, daysOverdue, formatDate, loanStatus, today as todayOf, type BookDetail, type LoanWithDetails } from '@/domain';
import { useLibraryEvent } from '@/features/events';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useReturnFlow } from './ReturnFlow';
import { loanIssueMessage, useLend } from './useLend';

/** How long the RETURNED stamp and Booky's welcome stay after a return. */
export const WELCOME_HOME_MS = 5000;

type OpenLoan = NonNullable<BookDetail['openLoan']>;

/** "Lent to Sam on 5 Jun 2026. Due back on 26 Jun 2026." (or how long ago it was due). */
export function loanSummary(loan: OpenLoan, today: string): string {
  const lent = `Lent to ${loan.borrowerName} on ${formatDate(loan.lentOn)}.`;
  if (!loan.dueOn) return `${lent} No due date.`;
  if (loanStatus(loan, today) === 'overdue') return `${lent} It was due back on ${formatDate(loan.dueOn)} (${dayCount(daysOverdue(loan, today))} ago).`;
  return `${lent} Due back on ${formatDate(loan.dueOn)}.`;
}

/**
 * The Loan section of book detail: the ON LOAN stamp and "Mark returned"
 * while the book is out, "Lend" while it is home, a brief RETURNED stamp
 * with Booky after a return, and the lending history.
 */
export function BookLoanSection({ book }: { book: BookDetail }) {
  const db = useDatabase();
  const { colors, spacing, sizes } = useTheme();
  const { show } = useSnackbar();
  const lending = useLend();
  const [lendOpen, setLendOpen] = useState(false);
  const [history, setHistory] = useState<LoanWithDetails[]>([]);
  const [version, setVersion] = useState(0);
  const [welcome, setWelcome] = useState(false);
  const today = todayOf();
  const loan = book.openLoan;

  useEffect(() => {
    let active = true;
    loansRepo
      .listLoansForBook(db, book.id)
      .then((list) => active && setHistory(list))
      .catch((e) => console.error('Could not load the lending history', e));
    return () => {
      active = false;
    };
  }, [db, book.id, version]);
  useLibraryEvent('loans-changed', () => setVersion((v) => v + 1));

  useEffect(() => {
    if (!welcome) return;
    const timer = setTimeout(() => setWelcome(false), WELCOME_HOME_MS);
    return () => clearTimeout(timer);
  }, [welcome]);

  const returning = useReturnFlow(() => setWelcome(true));

  const submit = useCallback(
    async (values: LendValues): Promise<LendSubmitResult> => {
      const outcome = await lending.lend({ bookId: book.id, ...values });
      if (outcome.status === 'lent') {
        setLendOpen(false);
        show({ message: `Lent to ${outcome.borrowerName}` });
        return { status: 'lent' };
      }
      if (outcome.status === 'already-on-loan') {
        setLendOpen(false);
        show({ message: outcome.current ? `“${book.title}” is already on loan to ${outcome.current.borrowerName}.` : `“${book.title}” is already on loan.` });
        return { status: 'handled' };
      }
      return outcome;
    },
    [lending, book.id, book.title, show],
  );

  return (
    <View style={{ gap: spacing.md }}>
      {loan ? (
        <>
          <View style={[styles.row, { gap: spacing.md }]}>
            <LoanStamp loan={loan} today={today} prefix={`On loan · ${loan.borrowerName}`} testID={Testids.bookLoan.stamp} />
          </View>
          <Text testID={Testids.bookLoan.summary}>{loanSummary(loan, today)}</Text>
          {loan.note ? <Text color="inkMuted">{`Note: ${loan.note}`}</Text> : null}
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Button
              label="Mark returned"
              icon={<MaterialCommunityIcons name="book-arrow-left-outline" size={sizes.icon} color={colors.onPrimary} />}
              onPress={() => returning.start({ ...loan, bookTitle: book.title })}
              testID={Testids.returnLoan.open}
            />
            <Button
              label={`About ${loan.borrowerName}`}
              variant="ghost"
              accessibilityLabel={`See everything ${loan.borrowerName} has borrowed`}
              onPress={() => router.navigate({ pathname: '/borrower/[id]', params: { id: String(loan.borrowerId) } })}
              testID={Testids.bookLoan.borrower}
            />
          </View>
        </>
      ) : (
        <>
          {welcome && !loan ? (
            <View testID={Testids.bookLoan.welcome} role="status" aria-live="polite" accessibilityLiveRegion="polite" style={[styles.row, { gap: spacing.md }]}>
              <Booky expression="happy" size={56} animated={false} />
              <Stamp label="Returned" tone="success" />
              <Text style={styles.flex}>{`Welcome home, “${book.title}”!`}</Text>
            </View>
          ) : (
            <Text color="inkMuted">On the shelf, not lent to anyone.</Text>
          )}
          <Button
            label="Lend"
            variant="secondary"
            accessibilityLabel={`Lend ${book.title}`}
            icon={<MaterialCommunityIcons name="book-arrow-right-outline" size={sizes.icon} color={colors.onPrimaryContainer} />}
            onPress={() => setLendOpen(true)}
            testID={Testids.lend.open}
          />
        </>
      )}
      <BookLoanHistory loans={history} />
      {lendOpen ? (
        <LendSheet
          visible
          bookTitle={book.title}
          today={today}
          loanDays={lending.loanDays}
          search={lending.searchBorrowers}
          findByName={lending.findBorrowerByName}
          issueMessage={loanIssueMessage}
          onSubmit={submit}
          onClose={() => setLendOpen(false)}
        />
      ) : null}
      {returning.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 160 },
});
