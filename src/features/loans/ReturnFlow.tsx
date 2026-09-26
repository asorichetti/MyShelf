import { useCallback, useState, type ReactNode } from 'react';

import { ReturnSheet } from '@/components/loans/ReturnSheet';
import { today, type LoanWithDetails } from '@/domain';

import { loanIssueMessage } from './useLend';
import { useReturn } from './useReturn';

type ReturningLoan = Pick<LoanWithDetails, 'id' | 'bookTitle' | 'borrowerName' | 'lentOn' | 'dueOn'>;

/**
 * "Mark returned" from anywhere: `start(loan)` opens the return sheet, and
 * `sheet` must be rendered by the screen. `onReturned` runs after a save.
 */
export function useReturnFlow(onReturned?: (loan: ReturningLoan) => void): { start: (loan: ReturningLoan) => void; sheet: ReactNode } {
  const [loan, setLoan] = useState<ReturningLoan | null>(null);
  const { returnLoan } = useReturn();
  const start = useCallback((next: ReturningLoan) => setLoan(next), []);

  const sheet = loan ? (
    <ReturnSheet
      key={loan.id}
      visible
      loan={loan}
      today={today()}
      issueMessage={loanIssueMessage}
      onClose={() => setLoan(null)}
      onConfirm={async (returnedOn) => {
        const problem = await returnLoan(loan, returnedOn);
        if (!problem) {
          setLoan(null);
          onReturned?.(loan);
        }
        return problem;
      }}
    />
  ) : null;
  return { start, sheet };
}
