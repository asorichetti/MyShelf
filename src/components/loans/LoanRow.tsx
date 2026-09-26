import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { Button, Text } from '@/components/ui';
import { formatDate, type IsoDate, type LoanWithDetails } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { LoanStamp } from './LoanStamp';

export interface LoanRowProps {
  loan: LoanWithDetails;
  today: IsoDate;
  onOpenBook: (bookId: number) => void;
  /** Omit on a borrower's own page, where the name would repeat. */
  onOpenBorrower?: (borrowerId: number) => void;
  /** Offered for open loans. */
  onReturn?: (loan: LoanWithDetails) => void;
}

/**
 * One loan as a library card pocket: cover, title, who has it and since
 * when, the due-date stamp, and "Mark returned" while it is out. The title
 * and the borrower's name are separate buttons (to the book and to the
 * borrower), so the card itself is not one.
 */
export const LoanRow = memo(function LoanRow({ loan, today, onOpenBook, onOpenBorrower, onReturn }: LoanRowProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const open = loan.returnedOn == null;
  const dates = open
    ? t('loans.row.lent', { date: formatDate(loan.lentOn) })
    : t('loans.row.lentAndBack', { lent: formatDate(loan.lentOn), back: formatDate(loan.returnedOn!) });

  return (
    <View
      testID={Testids.loans.row}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, boxShadow: theme.elevation.card, overflow: 'hidden' },
      ]}
    >
      {/* The pocket's rim: a berry band, as on a library card pocket. */}
      <View aria-hidden style={{ height: spacing.xs, backgroundColor: colors.cardRule }} />
      <View style={[styles.body, { padding: spacing.md, gap: spacing.md }]}>
        <CoverImage uri={loan.bookCoverUri} title={loan.bookTitle} size="thumb" />
        <View style={[styles.text, { gap: spacing.xxs }]}>
          <Pressable
            role="button"
            accessibilityLabel={t('loans.row.openBook', { title: loan.bookTitle })}
            onPress={() => onOpenBook(loan.bookId)}
            testID={Testids.loans.rowBook}
            style={({ pressed }) => [
              styles.link,
              { minHeight: sizes.touchTarget, minWidth: sizes.touchTarget, borderRadius: radii.sm },
              pressed && { backgroundColor: colors.surfaceTint },
            ]}
          >
            <Text style={theme.typography.h3} numberOfLines={2}>
              {loan.bookTitle}
            </Text>
          </Pressable>
          {onOpenBorrower ? (
            <View style={[styles.line, { gap: spacing.xs }]}>
              <Text color="inkMuted">{open ? t('loans.row.with') : t('loans.row.borrowedBy')}</Text>
              <Pressable
                role="button"
                accessibilityLabel={t('loans.row.borrowerLabel', { name: loan.borrowerName })}
                onPress={() => onOpenBorrower(loan.borrowerId)}
                testID={Testids.loans.rowBorrower}
                style={({ pressed }) => [
                  styles.link,
                  { minHeight: sizes.touchTarget, minWidth: sizes.touchTarget, paddingHorizontal: spacing.xs, borderRadius: radii.sm },
                  pressed && { backgroundColor: colors.surfaceTint },
                ]}
              >
                <Text variant="bodyStrong" color="primary" style={styles.underline}>
                  {loan.borrowerName}
                </Text>
              </Pressable>
            </View>
          ) : null}
          <Text variant="mono" color="inkMuted">
            {dates}
          </Text>
          {loan.note ? (
            <Text variant="caption" color="inkMuted" numberOfLines={2}>
              {loan.note}
            </Text>
          ) : null}
          <LoanStamp loan={loan} today={today} rotate={-3} testID={Testids.loans.stamp} style={{ marginTop: spacing.xs }} />
        </View>
      </View>
      {open && onReturn ? (
        <View style={[styles.actions, { paddingHorizontal: spacing.md, paddingBottom: spacing.md }]}>
          <Button
            label={t('loans.markReturned')}
            variant="secondary"
            accessibilityLabel={t('loans.row.markReturnedLabel', { title: loan.bookTitle })}
            onPress={() => onReturn(loan)}
            testID={Testids.loans.rowReturn}
          />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  body: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flex: 1, minWidth: 0 },
  link: { justifyContent: 'center', alignSelf: 'flex-start' },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  underline: { textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
