import { fireEvent, screen } from '@testing-library/react-native';

import { ShelfToolbar } from '@/components/book/ShelfToolbar';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function renderToolbar(query = '', sortOpen = false) {
  const onQueryChange = jest.fn();
  const onOpenSort = jest.fn();
  renderWithTheme(
    <ShelfToolbar query={query} onQueryChange={onQueryChange} sortLabel="Library order" sortDescription="Genre, then Author" onOpenSort={onOpenSort} sortOpen={sortOpen} />,
  );
  return { onQueryChange, onOpenSort };
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

describe('ShelfToolbar sort button', () => {
  it('names the sort and opens the Sort sheet', () => {
    const { onOpenSort } = renderToolbar();
    const button = screen.getByTestId(Testids.home.sortButton);
    expect(button).toHaveTextContent(/Sort: Library order$/);
    expect(button.props.accessibilityLabel).toBe('Sort by Genre, then Author');
    expect(button).toBeCollapsed();
    fireEvent.press(button);
    expect(onOpenSort).toHaveBeenCalledTimes(1);
  });

  it('reports the open sheet', () => {
    renderToolbar('', true);
    expect(screen.getByTestId(Testids.home.sortButton)).toBeExpanded();
  });
});
