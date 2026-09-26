import { act, fireEvent, screen } from '@testing-library/react-native';

import { BookRow, bookRowLabel } from '@/components/book/BookRow';
import { ShelfLoanStamp } from '@/components/loans/ShelfLoanStamp';
import { setToday, today, type BookListItem } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
import { lightTheme } from '@/theme';

const mort: BookListItem = {
  id: 7,
  title: 'Mort',
  subtitle: null,
  authors: ['Terry Pratchett'],
  coverUri: null,
  publicationYear: 1987,
  seriesName: 'Discworld',
  seriesPosition: 4,
  onLoan: false,
};

/** As the Shelf renders it: the loan stamp goes in the row's badges slot. */
async function renderRow(item: BookListItem, onPress = jest.fn()) {
  renderWithTheme(<BookRow item={item} onPress={onPress} badges={item.onLoan ? <ShelfLoanStamp item={item} today={today()} /> : undefined} />);
  await act(async () => {});
  return onPress;
}

describe('bookRowLabel', () => {
  it('reads "Title, by Author, Year"', () => {
    expect(bookRowLabel(mort)).toBe('Mort, by Terry Pratchett, 1987');
  });

  it('joins several authors, skips what is missing and mentions a loan', () => {
    expect(bookRowLabel({ ...mort, authors: ['Terry Pratchett', 'Neil Gaiman'], onLoan: true })).toBe(
      'Mort, by Terry Pratchett and Neil Gaiman, 1987, on loan',
    );
    expect(bookRowLabel({ ...mort, onLoan: true, loanBorrower: 'Sam', loanDueOn: '2026-06-26' }, '2026-06-15')).toBe(
      'Mort, by Terry Pratchett, 1987, on loan to Sam',
    );
    expect(bookRowLabel({ ...mort, onLoan: true, loanBorrower: 'Priya', loanDueOn: '2026-06-10' }, '2026-06-15')).toBe(
      'Mort, by Terry Pratchett, 1987, on loan to Priya, overdue',
    );
    expect(bookRowLabel({ ...mort, authors: [], publicationYear: null })).toBe('Mort');
  });

  it('says the rating after the year and before a loan', () => {
    expect(bookRowLabel({ ...mort, rating: 4 })).toBe('Mort, by Terry Pratchett, 1987, rated 4 out of 5');
    expect(bookRowLabel({ ...mort, rating: null })).toBe('Mort, by Terry Pratchett, 1987');
    expect(bookRowLabel({ ...mort, rating: 1, onLoan: true, loanBorrower: 'Sam', loanDueOn: '2026-06-26' }, '2026-06-15')).toBe(
      'Mort, by Terry Pratchett, 1987, rated 1 out of 5, on loan to Sam',
    );
  });
});

describe('BookRow', () => {
  it('shows small stars for a rated book, and none for an unrated one', async () => {
    await renderRow({ ...mort, rating: 3 });
    expect(screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987, rated 3 out of 5' })).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.rating.display, { includeHiddenElements: true })).toBeTruthy();
    screen.unmount();
    await renderRow(mort);
    expect(screen.queryByTestId(Testids.rating.display, { includeHiddenElements: true })).toBeNull();
  });

  it('is one button named by its label that opens the book', async () => {
    const onPress = await renderRow(mort);
    const row = screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987' });
    expect(row.props.testID).toBe(Testids.home.row);
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledWith(7);
  });

  it('shows the title in Lora, author and year in Courier Prime, and a series badge', async () => {
    await renderRow(mort);
    expect(screen.getByText('Mort')).toHaveStyle({ fontFamily: lightTheme.fonts.heading });
    expect(screen.getByText('Terry Pratchett')).toHaveStyle({ fontFamily: lightTheme.fonts.mono });
    expect(screen.getByText('1987')).toHaveStyle({ fontFamily: lightTheme.fonts.mono });
    expect(screen.getByText('Discworld #4')).toBeOnTheScreen();
    expect(screen.queryByText('On loan')).toBeNull();
  });

  it('shows the loan stamp from its badges slot', async () => {
    await renderRow({ ...mort, onLoan: true });
    expect(screen.getByText('On loan')).toHaveStyle({ fontFamily: lightTheme.typography.stamp.fontFamily });
  });

  describe('loan variants (P05-09)', () => {
    beforeEach(() => setToday('2026-06-15'));
    afterEach(() => setToday(null));

    it('on loan: an "On loan" stamp, and the row says who has it', async () => {
      await renderRow({ ...mort, onLoan: true, loanBorrower: 'Sam', loanDueOn: '2026-06-26' });
      expect(screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987, on loan to Sam' })).toBeOnTheScreen();
      expect(screen.getByTestId(Testids.bookLoan.badge)).toHaveTextContent('On loan');
      expect(screen.getByText('On loan')).toHaveStyle({ color: lightTheme.colors.accent });
    });

    it('due today is still "On loan", not overdue', async () => {
      await renderRow({ ...mort, onLoan: true, loanBorrower: 'Sam', loanDueOn: '2026-06-15' });
      expect(screen.getByTestId(Testids.bookLoan.badge)).toHaveTextContent('On loan');
    });

    it('overdue: an "Overdue" stamp in danger ink, and the row says so', async () => {
      await renderRow({ ...mort, onLoan: true, loanBorrower: 'Priya', loanDueOn: '2026-06-10' });
      expect(screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987, on loan to Priya, overdue' })).toBeOnTheScreen();
      expect(screen.getByText('Overdue')).toHaveStyle({ color: lightTheme.colors.danger });
    });

    it('no due date: never overdue', async () => {
      await renderRow({ ...mort, onLoan: true, loanBorrower: 'Kim', loanDueOn: null });
      expect(screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987, on loan to Kim' })).toBeOnTheScreen();
    });

    it('at home: no stamp', async () => {
      await renderRow({ ...mort, loanBorrower: null, loanDueOn: null });
      expect(screen.queryByTestId(Testids.bookLoan.badge)).toBeNull();
    });
  });

  it('leaves out the year and series when unknown', async () => {
    await renderRow({ ...mort, publicationYear: null, seriesName: null, seriesPosition: null, authors: [] });
    expect(screen.queryByText('1987')).toBeNull();
    expect(screen.queryByText(/Discworld/)).toBeNull();
  });
});
