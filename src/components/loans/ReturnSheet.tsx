import { useState } from 'react';
import { View } from 'react-native';

import { Button, DateField, Sheet, Text } from '@/components/ui';
import { formatDate, validateLoanDates, type IsoDate, type LoanIssue, type LoanWithDetails } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface ReturnSheetProps {
  loan: Pick<LoanWithDetails, 'bookTitle' | 'borrowerName' | 'lentOn' | 'dueOn'>;
  visible: boolean;
  today: IsoDate;
  /** Resolves with an error message to show, or null when the return was saved. */
  onConfirm: (returnedOn: IsoDate) => Promise<string | null>;
  onClose: () => void;
  issueMessage: (issue: LoanIssue) => string;
}

/** "Mark returned" confirmation with the day it came back (today by default). */
export function ReturnSheet({ loan, visible, today, onConfirm, onClose, issueMessage }: ReturnSheetProps) {
  const { colors, spacing, radii } = useTheme();
  const [returnedOn, setReturnedOn] = useState<string>(today);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    const issue = validateLoanDates({ lentOn: loan.lentOn, dueOn: loan.dueOn, returnedOn }, today).find((i) => i.field === 'returnedOn');
    if (issue) {
      setError(issueMessage(issue));
      return;
    }
    setSaving(true);
    try {
      const problem = await onConfirm(returnedOn);
      if (problem) setError(problem);
    } catch (e) {
      console.error('Could not mark the book returned', e);
      setError('Sorry, I couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={`Mark “${loan.bookTitle}” returned?`}
      subtitle={`Lent to ${loan.borrowerName} on ${formatDate(loan.lentOn)}.`}
      onClose={onClose}
      busy={saving}
      testID={Testids.returnLoan.sheet}
      footer={
        <>
          <Button label="Not yet" variant="secondary" onPress={onClose} disabled={saving} testID={Testids.returnLoan.cancel} />
          <Button label="Mark returned" onPress={() => void confirm()} loading={saving} testID={Testids.returnLoan.confirm} />
        </>
      }
    >
      {error ? (
        <View role="alert" testID={Testids.returnLoan.error} style={{ padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.dangerContainer }}>
          <Text color="onDangerContainer">{error}</Text>
        </View>
      ) : null}
      <DateField
        label="Came back on"
        value={returnedOn}
        onChange={(value) => {
          setReturnedOn(value);
          setError(null);
        }}
        min={loan.lentOn}
        max={today}
        testID={Testids.returnLoan.date}
      />
    </Sheet>
  );
}
