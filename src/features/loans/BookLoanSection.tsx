import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { BookLoanHistory } from '@/components/loans/BookLoanHistory';
import { LendSheet, type LendSubmitResult, type LendValues } from '@/components/loans/LendSheet';
import { LoanStamp } from '@/components/loans/LoanStamp';
import { Button, Stamp, Text, useSnackbar } from '@/components/ui';
import { focusViewIfLost } from '@/components/ui/focusView';
import { loansRepo, useDatabase } from '@/db';
import { daysOverdue, formatDate, loanStatus, today as todayOf, type BookDetail, type LoanWithDetails } from '@/domain';
import { useLibraryEvent } from '@/features/events';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useReturnFlow } from './ReturnFlow';
import { loanIssueMessage, useLend } from './useLend';

/** How long the RETURNED stamp and Booky's welcome stay after a return. */
export const WELCOME_HOME_MS = 5000;

type OpenLoan = NonNullable<BookDetail['openLoan']>;

/** "Lent to Sam on 5 Jun 2026. Due back on 26 Jun 2026." (or how long ago it was due). */
export function loanSummary(loan: OpenLoan, today: string): string {
  const lent = { name: loan.borrowerName, date: formatDate(loan.lentOn) };
  if (!loan.dueOn) return t('loans.bookSection.summaryNoDue', lent);
  const due = formatDate(loan.dueOn);
  if (loanStatus(loan, today) === 'overdue') return t('loans.bookSection.summaryOverdue', { ...lent, due, count: daysOverdue(loan, today) });
  return t('loans.bookSection.summaryDue', { ...lent, due });
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
  // Lending swaps Lend for Mark returned, and returning swaps them back: the
  // button that had focus is gone, so its replacement takes focus.
  const primary = useRef<View>(null);
  const out = loan != null;
  const wasOut = useRef(out);
  useEffect(() => {
    if (wasOut.current === out) return;
    wasOut.current = out;
    focusViewIfLost(primary.current);
  }, [out]);

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
        show({ message: t('loans.bookSection.lent', { name: outcome.borrowerName }) });
        return { status: 'lent' };
      }
      if (outcome.status === 'already-on-loan') {
        setLendOpen(false);
        show({
          message: outcome.current
            ? t('loans.bookSection.alreadyOnLoanTo', { title: book.title, name: outcome.current.borrowerName })
            : t('loans.bookSection.alreadyOnLoan', { title: book.title }),
        });
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
            <LoanStamp loan={loan} today={today} prefix={t('loans.bookSection.stampPrefix', { name: loan.borrowerName })} testID={Testids.bookLoan.stamp} />
          </View>
          <Text testID={Testids.bookLoan.summary}>{loanSummary(loan, today)}</Text>
          {loan.note ? <Text color="inkMuted">{t('loans.bookSection.note', { note: loan.note })}</Text> : null}
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Button
              ref={primary}
              label={t('loans.markReturned')}
              icon={<MaterialCommunityIcons name="book-arrow-left-outline" size={sizes.icon} color={colors.onPrimary} />}
              onPress={() => returning.start({ ...loan, bookTitle: book.title })}
              testID={Testids.returnLoan.open}
            />
            <Button
              label={t('loans.bookSection.aboutBorrower', { name: loan.borrowerName })}
              variant="ghost"
              accessibilityLabel={t('loans.bookSection.aboutBorrowerLabel', { name: loan.borrowerName })}
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
              <Stamp label={t('loans.bookSection.returnedStamp')} tone="success" />
              <Text style={styles.flex}>{t('returnLoan.welcomeHome', { title: book.title })}</Text>
            </View>
          ) : (
            <Text color="inkMuted">{t('loans.bookSection.onShelf')}</Text>
          )}
          <Button
            ref={primary}
            label={t('loans.bookSection.lend')}
            variant="secondary"
            accessibilityLabel={t('loans.bookSection.lendLabel', { title: book.title })}
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
