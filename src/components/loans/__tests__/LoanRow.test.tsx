import { act, fireEvent, screen } from '@testing-library/react-native';

import { LoanRow } from '@/components/loans/LoanRow';
import type { LoanWithDetails } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
import { lightTheme } from '@/theme';

const base: LoanWithDetails = {
  id: 7,
  bookId: 3,
  borrowerId: 9,
  bookTitle: 'The Murder of Roger Ackroyd',
  borrowerName: 'Priya',
  lentOn: '2026-05-16',
  dueOn: '2026-06-10',
  returnedOn: null,
  note: 'Promised to bring it to book club.',
  bookCoverUri: null,
};

async function renderRow(loan: LoanWithDetails, handlers: Partial<Record<'onOpenBook' | 'onOpenBorrower' | 'onReturn', jest.Mock>> = {}) {
  const h = { onOpenBook: jest.fn(), onOpenBorrower: jest.fn(), onReturn: jest.fn(), ...handlers };
  renderWithTheme(<LoanRow loan={loan} today="2026-06-15" {...h} />);
  await act(async () => {});
  return h;
}

const stamp = () => screen.getByTestId(Testids.loans.stamp);

describe('LoanRow', () => {
  it('shows an overdue loan with a danger "OVERDUE · 5 DAYS" stamp read out in words', async () => {
    await renderRow(base);
    expect(stamp()).toHaveTextContent('Overdue · 5 days');
    expect(stamp().props.accessibilityLabel).toBe('Overdue by 5 days, it was due back on 10 Jun 2026');
    expect(screen.getByText('Overdue · 5 days')).toHaveStyle({ color: lightTheme.colors.danger, textTransform: 'uppercase' });
    expect(screen.getByText('Lent 16 May 2026')).toBeOnTheScreen();
    expect(screen.getByText('Promised to bring it to book club.')).toBeOnTheScreen();
  });

  it.each([
    ['due soon', { dueOn: '2026-06-17' }, 'Due 17 Jun', 'warn'],
    ['due later', { dueOn: '2026-07-01' }, 'Due 1 Jul', 'accent'],
    ['no due date', { dueOn: null }, 'On loan', 'accent'],
    ['returned', { returnedOn: '2026-06-12' }, 'Returned 12 Jun', 'success'],
  ] as const)('stamps a loan that is %s', async (_, patch, label, tone) => {
    await renderRow({ ...base, ...patch });
    expect(screen.getByText(label)).toHaveStyle({ color: lightTheme.colors[tone] });
  });

  it('opens the book, the borrower, and offers Mark returned while out', async () => {
    const h = await renderRow(base);
    fireEvent.press(screen.getByRole('button', { name: 'Open The Murder of Roger Ackroyd' }));
    expect(h.onOpenBook).toHaveBeenCalledWith(3);
    fireEvent.press(screen.getByRole('button', { name: 'Priya, see everything they have borrowed' }));
    expect(h.onOpenBorrower).toHaveBeenCalledWith(9);
    fireEvent.press(screen.getByRole('button', { name: 'Mark The Murder of Roger Ackroyd returned' }));
    expect(h.onReturn).toHaveBeenCalledWith(base);
  });

  it('has no Mark returned once returned, and dates the return', async () => {
    await renderRow({ ...base, returnedOn: '2026-06-12' });
    expect(screen.queryByTestId(Testids.loans.rowReturn)).toBeNull();
    expect(screen.getByText('Lent 16 May 2026, back 12 Jun 2026')).toBeOnTheScreen();
    expect(screen.getByText('Borrowed by')).toBeOnTheScreen();
  });

  it('leaves the borrower out on their own page', async () => {
    renderWithTheme(<LoanRow loan={base} today="2026-06-15" onOpenBook={jest.fn()} />);
    await act(async () => {});
    expect(screen.queryByTestId(Testids.loans.rowBorrower)).toBeNull();
    expect(screen.queryByTestId(Testids.loans.rowReturn)).toBeNull();
  });

  it('keeps every control at least 48 dp tall', async () => {
    await renderRow(base);
    for (const id of [Testids.loans.rowBook, Testids.loans.rowBorrower]) {
      const style = screen.getByTestId(id).props.style;
      expect(Array.isArray(style) ? Object.assign({}, ...style.flat()) : style).toMatchObject({ minHeight: 48, minWidth: 48 });
    }
  });
});
