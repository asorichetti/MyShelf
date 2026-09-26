import { act, fireEvent, screen } from '@testing-library/react-native';

import { ReorderList } from '@/components/groups/ReorderList';
import type { BookListItem } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const item = (id: number, title: string): BookListItem => ({
  id,
  title,
  subtitle: null,
  authors: [],
  coverUri: null,
  publicationYear: null,
  seriesName: null,
  seriesPosition: null,
  onLoan: false,
});
const items = [item(1, 'Good Omens'), item(2, 'Mort'), item(3, 'Dune')];

describe('ReorderList', () => {
  it('has move up and move down buttons named after each book', () => {
    renderWithTheme(<ReorderList items={items} onMove={jest.fn()} />);
    expect(screen.getAllByTestId(Testids.groups.moveUp)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Move Mort up' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Move Mort down' })).toBeOnTheScreen();
  });

  it('disables moving past either end', () => {
    renderWithTheme(<ReorderList items={items} onMove={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Move Good Omens up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Dune down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Dune up' })).toBeEnabled();
  });

  it('moves a book and announces where it went', async () => {
    const onMove = jest.fn();
    renderWithTheme(<ReorderList items={items} onMove={onMove} />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Move Dune up' })));
    expect(onMove).toHaveBeenCalledWith(2, 1);
    expect(screen.getByText('Dune moved to 2 of 3')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Move Good Omens down' })));
    expect(onMove).toHaveBeenLastCalledWith(0, 1);
  });

  it('numbers the rows for screen readers', () => {
    renderWithTheme(<ReorderList items={items} onMove={jest.fn()} />);
    expect(screen.getAllByTestId(Testids.groups.reorderRow).map((r) => r.props['aria-label'])).toEqual(['1. Good Omens', '2. Mort', '3. Dune']);
  });
});
