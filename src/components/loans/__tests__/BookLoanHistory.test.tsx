import { act, fireEvent, screen } from '@testing-library/react-native';

import { BookLoanHistory, pastLoans } from '@/components/loans/BookLoanHistory';
import type { LoanWithDetails } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const loan = (id: number, borrowerName: string, lentOn: string, returnedOn: string | null, note: string | null = null): LoanWithDetails => ({
  id,
  bookId: 1,
  borrowerId: id,
  bookTitle: 'Dune',
  borrowerName,
  lentOn,
  dueOn: null,
  returnedOn,
  note,
});

const loans = [
  loan(1, 'Sam', '2025-01-10', '2025-02-01'),
  loan(2, 'Priya', '2026-03-05', '2026-03-30', 'Coffee stain on p. 12'),
  loan(3, 'Kim', '2026-06-01', null),
  loan(4, 'Alex', '2025-11-20', '2025-12-24'),
];

describe('pastLoans', () => {
  it('keeps returned loans, most recently lent first', () => {
    expect(pastLoans(loans).map((l) => l.borrowerName)).toEqual(['Priya', 'Alex', 'Sam']);
  });
});

describe('BookLoanHistory', () => {
  it('renders nothing without returned loans', () => {
    renderWithTheme(<BookLoanHistory loans={[loans[2]]} />);
    expect(screen.queryByTestId(Testids.bookLoan.history)).toBeNull();
    expect(screen.queryByText(/Lending history/)).toBeNull();
  });

  it('is a collapsed disclosure that lists borrower, dates and note, newest first', async () => {
    renderWithTheme(<BookLoanHistory loans={loans} />);
    const toggle = screen.getByRole('button', { name: 'Lending history, 3 past loans' });
    expect(toggle).not.toBeExpanded();
    expect(screen.queryAllByTestId(Testids.bookLoan.historyRow)).toHaveLength(0);
    await act(async () => fireEvent.press(toggle));
    expect(screen.getByTestId(Testids.bookLoan.historyToggle)).toBeExpanded();
    const rows = screen.getAllByTestId(Testids.bookLoan.historyRow);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Priya5 Mar 2026 – 30 Mar 2026Coffee stain on p. 12');
    expect(rows[1]).toHaveTextContent('Alex20 Nov 2025 – 24 Dec 2025');
    expect(rows[2]).toHaveTextContent('Sam10 Jan 2025 – 1 Feb 2025');
    expect(screen.queryByText('Kim')).toBeNull();
  });
});
