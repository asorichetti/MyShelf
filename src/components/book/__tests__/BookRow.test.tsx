import { act, fireEvent, screen } from '@testing-library/react-native';

import { BookRow, bookRowLabel } from '@/components/book/BookRow';
import type { BookListItem } from '@/domain';
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

async function renderRow(item: BookListItem, onPress = jest.fn()) {
  renderWithTheme(<BookRow item={item} onPress={onPress} />);
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
    expect(bookRowLabel({ ...mort, authors: [], publicationYear: null })).toBe('Mort');
  });
});

describe('BookRow', () => {
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

  it('stamps books that are on loan', async () => {
    await renderRow({ ...mort, onLoan: true });
    expect(screen.getByText('On loan')).toHaveStyle({ fontFamily: lightTheme.typography.stamp.fontFamily });
  });

  it('leaves out the year and series when unknown', async () => {
    await renderRow({ ...mort, publicationYear: null, seriesName: null, seriesPosition: null, authors: [] });
    expect(screen.queryByText('1987')).toBeNull();
    expect(screen.queryByText(/Discworld/)).toBeNull();
  });
});
