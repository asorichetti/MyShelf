import { fireEvent, screen } from '@testing-library/react-native';

import { SPINE_MAX_WIDTH, SPINE_MIN_WIDTH, SpineShelf, spinesPerShelf, spineWidth } from '@/components/book/SpineShelf';
import type { BookListItem } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
import { contrastRatio, lightTheme } from '@/theme';

const long = 'The Nice and Accurate Prophecies of Agnes Nutter, Witch, Being a Very Long Title Indeed';
const book = (id: number, title: string): BookListItem => ({
  id,
  title,
  subtitle: null,
  authors: ['Neil Gaiman'],
  coverUri: null,
  publicationYear: 1990,
  seriesName: null,
  seriesPosition: null,
  onLoan: false,
});

describe('SpineShelf', () => {
  it('gives every spine a stable width no narrower than a touch target', () => {
    for (const t of ['Mort', 'Dune', long, 'A']) {
      expect(spineWidth(t)).toBeGreaterThanOrEqual(Math.max(48, SPINE_MIN_WIDTH));
      expect(spineWidth(t)).toBeLessThanOrEqual(SPINE_MAX_WIDTH);
      expect(spineWidth(t)).toBe(spineWidth(t));
    }
  });

  it('fits as many spines as the shelf allows', () => {
    expect(spinesPerShelf(354)).toBe(5);
    expect(spinesPerShelf(30)).toBe(1);
  });

  it('cuts a long title short with an ellipsis but names the spine in full', () => {
    const onPress = jest.fn();
    renderWithTheme(<SpineShelf items={[book(1, long), book(2, 'Mort')]} onPress={onPress} />);
    const spine = screen.getByRole('button', { name: `${long}, by Neil Gaiman, 1990` });
    const title = screen.getByText(long, { includeHiddenElements: true });
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.ellipsizeMode).toBe('tail');
    expect(screen.getAllByTestId(Testids.shelfView.spine)).toHaveLength(2);
    fireEvent.press(spine);
    expect(onPress).toHaveBeenCalledWith(1);
  });

  it('draws spine titles in colours that meet AA contrast', () => {
    for (const c of lightTheme.covers) expect(contrastRatio(c.ink, c.cloth)).toBeGreaterThanOrEqual(4.5);
  });

  it('turns spines into checkboxes while selecting', () => {
    renderWithTheme(<SpineShelf items={[book(1, 'Mort')]} onPress={jest.fn()} isSelected={() => true} />);
    expect(screen.getByRole('checkbox', { name: /^Mort/ })).toBeChecked();
  });
});
