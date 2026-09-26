import { Stamp } from '@/components/ui';
import { loanStatus, type IsoDate } from '@/domain';
import { Testids } from '@/testing/testids.gen';

export interface ShelfLoanInfo {
  onLoan: boolean;
  loanBorrower?: string | null;
  loanDueOn?: IsoDate | null;
}

/** "on loan to Sam", "on loan to Priya, overdue": the words a Shelf row adds for its loan. */
export function shelfLoanLabel(item: ShelfLoanInfo, today: IsoDate): string | null {
  if (!item.onLoan) return null;
  const who = item.loanBorrower ? `on loan to ${item.loanBorrower}` : 'on loan';
  return loanStatus({ dueOn: item.loanDueOn ?? null, returnedOn: null }, today) === 'overdue' ? `${who}, overdue` : who;
}

/**
 * The Shelf row's loan stamp: "On loan", or "Overdue" in stamp red. The row
 * reads the details out in its own label, so the stamp is not announced twice.
 */
export function ShelfLoanStamp({ item, today }: { item: ShelfLoanInfo; today: IsoDate }) {
  if (!item.onLoan) return null;
  const overdue = loanStatus({ dueOn: item.loanDueOn ?? null, returnedOn: null }, today) === 'overdue';
  return <Stamp label={overdue ? 'Overdue' : 'On loan'} tone={overdue ? 'danger' : 'accent'} rotate={-6} testID={Testids.bookLoan.badge} />;
}
