import { fireEvent, screen } from '@testing-library/react-native';

import { directionLabel, ShelfToolbar } from '@/components/book/ShelfToolbar';
import type { ShelfSort } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function renderToolbar(query = '', sort: ShelfSort = { sort: 'title', direction: 'asc' }) {
  const onQueryChange = jest.fn();
  const onSortChange = jest.fn();
  renderWithTheme(<ShelfToolbar query={query} onQueryChange={onQueryChange} sort={sort} onSortChange={onSortChange} />);
  return { onQueryChange, onSortChange };
}

describe('ShelfToolbar search', () => {
  it('is a labelled search box that reports what is typed', () => {
    const { onQueryChange } = renderToolbar();
    const box = screen.getByLabelText('Search your shelf');
    expect(box.props.testID).toBe(Testids.home.search);
    fireEvent.changeText(box, 'prat');
    expect(onQueryChange).toHaveBeenCalledWith('prat');
  });

  it('offers a clear button only when there is text', () => {
    const { onQueryChange } = renderToolbar('prat');
    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('has no clear button when empty', () => {
    renderToolbar('');
    expect(screen.queryByTestId(Testids.home.searchClear)).toBeNull();
  });
});

describe('ShelfToolbar sort menu', () => {
  it('opens and closes, reporting its state', () => {
    renderToolbar();
    const button = screen.getByTestId(Testids.home.sortButton);
    expect(button).toHaveTextContent(/Sort: Title, A to Z$/);
    expect(button).toBeCollapsed();
    expect(screen.queryByTestId(Testids.home.sortYear)).toBeNull();
    fireEvent.press(button);
    expect(screen.getByTestId(Testids.home.sortButton)).toBeExpanded();
    expect(screen.getByRole('radio', { name: 'Title' })).toBeChecked();
    fireEvent.press(screen.getByTestId(Testids.home.sortButton));
    expect(screen.queryByTestId(Testids.home.sortYear)).toBeNull();
  });

  it.each([
    [Testids.home.sortAuthor, { sort: 'author', direction: 'asc' }],
    [Testids.home.sortYear, { sort: 'year', direction: 'asc' }],
    [Testids.home.sortAdded, { sort: 'added', direction: 'desc' }],
  ])('%s picks that order with its natural direction', (id, expected) => {
    const { onSortChange } = renderToolbar();
    fireEvent.press(screen.getByTestId(Testids.home.sortButton));
    fireEvent.press(screen.getByTestId(id));
    expect(onSortChange).toHaveBeenCalledWith(expected);
  });

  it('reverses the direction', () => {
    const { onSortChange } = renderToolbar('', { sort: 'year', direction: 'asc' });
    fireEvent.press(screen.getByTestId(Testids.home.sortButton));
    expect(screen.getByTestId(Testids.home.sortDirection)).toHaveTextContent(/Oldest first$/);
    fireEvent.press(screen.getByTestId(Testids.home.sortDirection));
    expect(onSortChange).toHaveBeenCalledWith({ sort: 'year', direction: 'desc' });
  });

  it('names directions in words', () => {
    expect(directionLabel({ sort: 'title', direction: 'desc' })).toBe('Z to A');
    expect(directionLabel({ sort: 'added', direction: 'desc' })).toBe('Newest first');
    expect(directionLabel({ sort: 'added', direction: 'asc' })).toBe('Oldest first');
  });
});
