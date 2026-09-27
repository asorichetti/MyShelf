import { screen } from '@testing-library/react-native';

import { GeneratedCover } from '@/components/book/GeneratedCover';
import { renderWithTheme } from '@/testing/render';

const hidden = { includeHiddenElements: true };

describe('GeneratedCover', () => {
  // On Android, lettering sized to its own measured width could wrap when
  // drawn and lose its second line ("J. R. R. Tolkien" drew as "J. R. R."),
  // and a name too long for a grid cell broke anywhere ("Fairwe / ather").
  it('sets the title and author across the cover, hyphenating long words', () => {
    renderWithTheme(<GeneratedCover title="The Hobbit" author="J. R. R. Tolkien" size="medium" />);
    for (const text of ['The Hobbit', 'J. R. R. Tolkien']) {
      const node = screen.getByText(text, hidden);
      expect(node).toHaveStyle({ alignSelf: 'stretch', textAlign: 'center' });
      expect(node.props.android_hyphenationFrequency).toBe('normal');
    }
  });

  it('shows only the initial on a thumbnail', () => {
    renderWithTheme(<GeneratedCover title="The Hobbit" author="J. R. R. Tolkien" />);
    expect(screen.getByText('H', hidden)).toBeTruthy();
    expect(screen.queryByText('J. R. R. Tolkien', hidden)).toBeNull();
  });
});
