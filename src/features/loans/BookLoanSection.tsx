import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LendSheet, type LendSubmitResult, type LendValues } from '@/components/loans/LendSheet';
import { LoanStamp } from '@/components/loans/LoanStamp';
import { Button, Text, useSnackbar } from '@/components/ui';
import { dayCount, daysOverdue, formatDate, loanStatus, today as todayOf, type BookDetail } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { loanIssueMessage, useLend } from './useLend';

type OpenLoan = NonNullable<BookDetail['openLoan']>;

/** "Lent to Sam on 5 Jun 2026. Due back on 26 Jun 2026." (or how long ago it was due). */
export function loanSummary(loan: OpenLoan, today: string): string {
  const lent = `Lent to ${loan.borrowerName} on ${formatDate(loan.lentOn)}.`;
  if (!loan.dueOn) return `${lent} No due date.`;
  if (loanStatus(loan, today) === 'overdue') return `${lent} It was due back on ${formatDate(loan.dueOn)} (${dayCount(daysOverdue(loan, today))} ago).`;
  return `${lent} Due back on ${formatDate(loan.dueOn)}.`;
}

/**
 * The Loan section of book detail: the ON LOAN stamp and loan details while
 * the book is out, "Lend" while it is home.
 */
export function BookLoanSection({ book }: { book: BookDetail }) {
  const { colors, spacing, sizes } = useTheme();
  const { show } = useSnackbar();
  const lending = useLend();
  const [lendOpen, setLendOpen] = useState(false);
  const today = todayOf();
  const loan = book.openLoan;

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
        </>
      ) : (
        <>
          <Text color="inkMuted">On the shelf, not lent to anyone.</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
