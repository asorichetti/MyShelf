import { Stamp } from '@/components/ui';
import { loanStatus, type IsoDate } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';

export interface ShelfLoanInfo {
  onLoan: boolean;
  loanBorrower?: string | null;
  loanDueOn?: IsoDate | null;
}

/** "on loan to Sam", "on loan to Priya, overdue": the words a Shelf row adds for its loan. */
export function shelfLoanLabel(item: ShelfLoanInfo, today: IsoDate): string | null {
  if (!item.onLoan) return null;
  const overdue = loanStatus({ dueOn: item.loanDueOn ?? null, returnedOn: null }, today) === 'overdue';
  if (item.loanBorrower) return overdue ? t('loans.shelf.onLoanToOverdue', { name: item.loanBorrower }) : t('loans.shelf.onLoanTo', { name: item.loanBorrower });
  return overdue ? t('loans.shelf.onLoanOverdue') : t('loans.shelf.onLoan');
}

/**
 * The Shelf row's loan stamp: "On loan", or "Overdue" in stamp red. The row
 * reads the details out in its own label, so the stamp is not announced twice.
 */
export function ShelfLoanStamp({ item, today }: { item: ShelfLoanInfo; today: IsoDate }) {
  if (!item.onLoan) return null;
  const overdue = loanStatus({ dueOn: item.loanDueOn ?? null, returnedOn: null }, today) === 'overdue';
  return <Stamp label={overdue ? t('loans.shelf.overdueStamp') : t('loanStamp.onLoan')} tone={overdue ? 'danger' : 'accent'} rotate={-6} testID={Testids.bookLoan.badge} />;
}
