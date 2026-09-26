import { fireEvent, screen } from '@testing-library/react-native';

import { chunk, CoverGridRow, coverColumns } from '@/components/book/CoverGrid';
import type { BookListItem } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const book = (id: number, title: string, extra: Partial<BookListItem> = {}): BookListItem => ({
  id,
  title,
  subtitle: null,
  authors: ['Terry Pratchett'],
  coverUri: `https://covers.example/${id}.jpg`,
  publicationYear: 1987,
  seriesName: null,
  seriesPosition: null,
  onLoan: false,
  ...extra,
});

describe('CoverGrid', () => {
  it('uses three columns on a phone and more on wider screens', () => {
    expect(coverColumns(354)).toBe(3);
    expect(coverColumns(700)).toBe(5);
    expect(coverColumns(2000)).toBe(6);
  });

  it('chunks a list into rows', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it('shows each book as a cover button named like a list row, sized to fit the row', () => {
    const onPress = jest.fn();
    renderWithTheme(<CoverGridRow items={[book(1, 'Mort'), book(2, 'Dune', { onLoan: true, coverUri: null })]} columns={3} width={354} onPress={onPress} />);
    const cells = screen.getAllByTestId(Testids.shelfView.coverCell);
    expect(cells).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dune, by Terry Pratchett, 1987, on loan' })).toBeOnTheScreen();
    expect(screen.getByText('On loan')).toBeOnTheScreen();
    // A real cover for Mort, the generated one for Dune.
    expect(screen.getAllByTestId(Testids.cover.image, { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getAllByTestId(Testids.cover.fallback, { includeHiddenElements: true })).toHaveLength(1);
    // Cells never overflow the row: 3 columns and 2 gaps fit in 354.
    const width = (cells[0].props.style as { width: number }[]).flat().find((s) => s && 'width' in s)!.width;
    expect(width * 3 + 12 * 2).toBeLessThanOrEqual(354);
    fireEvent.press(cells[0]);
    expect(onPress).toHaveBeenCalledWith(1);
  });

  it('turns cells into checkboxes while selecting', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    renderWithTheme(<CoverGridRow items={[book(1, 'Mort'), book(2, 'Dune')]} columns={3} width={354} onPress={onPress} onLongPress={onLongPress} isSelected={(id) => id === 2} />);
    expect(screen.getByRole('checkbox', { name: /^Dune/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Mort/ })).not.toBeChecked();
    expect(screen.getAllByTestId(Testids.selection.checkbox)).toHaveLength(2);
    fireEvent(screen.getByRole('checkbox', { name: /^Mort/ }), 'longPress');
    expect(onLongPress).toHaveBeenCalledWith(1);
  });
});
