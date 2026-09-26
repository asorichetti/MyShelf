import { fireEvent, screen } from '@testing-library/react-native';

import { BrowseChips } from '@/components/book/BrowseChips';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

describe('BrowseChips', () => {
  it.each([
    ['Browse genres', 'genres', Testids.shelfView.browseGenres],
    ['Browse series', 'series', Testids.shelfView.browseSeries],
    ['Browse authors', 'authors', Testids.shelfView.browseAuthors],
    ['Browse groups', 'groups', Testids.shelfView.browseGroups],
  ])('"%s" opens the %s index', (name, target, id) => {
    const onBrowse = jest.fn();
    renderWithTheme(<BrowseChips onBrowse={onBrowse} />);
    const chip = screen.getByRole('button', { name });
    expect(chip.props.testID).toBe(id);
    fireEvent.press(chip);
    expect(onBrowse).toHaveBeenCalledWith(target);
  });

  it('is a labelled navigation region', () => {
    renderWithTheme(<BrowseChips onBrowse={jest.fn()} />);
    const nav = screen.getByTestId(Testids.shelfView.browse);
    expect(nav.props.role).toBe('navigation');
    expect(nav.props['aria-label']).toBe('Browse');
  });
});
