import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { formatDate, type LoanWithDetails } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface BookLoanHistoryProps {
  /** The book's loans, any order; only returned ones are listed, newest first. */
  loans: readonly LoanWithDetails[];
}

/** Returned loans, most recently lent first. */
export function pastLoans(loans: readonly LoanWithDetails[]): LoanWithDetails[] {
  return loans
    .filter((l) => l.returnedOn != null)
    .sort((a, b) => (a.lentOn === b.lentOn ? b.id - a.id : a.lentOn < b.lentOn ? 1 : -1));
}

/**
 * "Lending history" on book detail: a disclosure listing who borrowed the
 * book before, when, and any note, newest first. Hidden when the book has
 * never come back from a loan.
 */
export function BookLoanHistory({ loans }: BookLoanHistoryProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const [open, setOpen] = useState(false);
  const listId = `loan-history-${useId().replace(/:/g, '')}`;
  const past = pastLoans(loans);
  if (!past.length) return null;
  const count = t('loanHistory.count', { count: past.length });

  return (
    <View testID={Testids.bookLoan.history} style={{ gap: spacing.sm }}>
      <Pressable
        role="button"
        aria-expanded={open}
        aria-controls={listId}
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('loanHistory.toggleLabel', { count: past.length })}
        onPress={() => setOpen((v) => !v)}
        testID={Testids.bookLoan.historyToggle}
        style={({ pressed }) => [
          styles.toggle,
          { minHeight: sizes.touchTarget, gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.sm },
          pressed && { backgroundColor: colors.surfaceTint },
        ]}
      >
        <MaterialCommunityIcons name={open ? 'chevron-down' : 'chevron-right'} size={sizes.icon} color={colors.primary} />
        <Text variant="bodyStrong" color="primary">
          {t('loanHistory.title')}
        </Text>
        <Text variant="caption" color="inkMuted">
          {count}
        </Text>
      </Pressable>
      {open ? (
        <View nativeID={listId} style={{ gap: spacing.sm }}>
          {past.map((loan) => (
            <View
              key={loan.id}
              testID={Testids.bookLoan.historyRow}
              style={[styles.row, { gap: spacing.xxs, padding: spacing.md, borderRadius: radii.md, borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text variant="bodyStrong">{loan.borrowerName}</Text>
              <Text variant="mono" color="inkMuted">
                {t('loanHistory.range', { from: formatDate(loan.lentOn), to: formatDate(loan.returnedOn!) })}
              </Text>
              {loan.note ? (
                <Text variant="caption" color="inkMuted">
                  {loan.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  row: { borderWidth: 1 },
});
