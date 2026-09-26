import { screen } from '@testing-library/react-native';

import { Spine, spineHeight } from '@/components/book/Spine';
import { renderWithTheme } from '@/testing/render';
import { lightColors } from '@/theme/tokens';

const hidden = { includeHiddenElements: true };

describe('Spine', () => {
  it('draws an owned book with its title and number, hidden from assistive tech', () => {
    renderWithTheme(<Spine title="Mort" position={4} testID="spine" />);
    const spine = screen.getByTestId('spine', hidden);
    expect(spine.props['aria-hidden']).toBe(true);
    expect(screen.getByText('Mort', hidden)).toBeTruthy();
    expect(screen.getByText('#4', hidden)).toBeTruthy();
  });

  it('draws a gap as a dashed outline saying which number is missing', () => {
    renderWithTheme(<Spine variant="missing" position={3} testID="gap" />);
    expect(screen.getByTestId('gap', hidden)).toHaveStyle({ borderStyle: 'dashed', borderColor: lightColors.outline });
    expect(screen.getByText('#3', hidden)).toBeTruthy();
    expect(screen.getByText('missing', hidden)).toBeTruthy();
  });

  it('shows fractional numbers as typed', () => {
    renderWithTheme(<Spine title="Novella" position={2.5} />);
    expect(screen.getByText('#2.5', hidden)).toBeTruthy();
  });

  it('keeps each book’s colour and height stable, and mini spines tiny and textless', () => {
    const a = renderWithTheme(<Spine title="Mort" position={4} testID="a" />);
    const first = JSON.stringify(a.toJSON());
    a.unmount();
    const b = renderWithTheme(<Spine title="Mort" position={4} testID="a" />);
    expect(JSON.stringify(b.toJSON())).toBe(first);
    b.unmount();
    expect(spineHeight('shelf', 'Mort')).toBe(spineHeight('shelf', 'Mort'));
    expect(spineHeight('mini', 'x')).toBe(28);
    renderWithTheme(<Spine size="mini" title="Mort" position={4} testID="mini" />);
    expect(screen.getByTestId('mini', hidden)).toHaveStyle({ width: 10, height: 28 });
    expect(screen.queryByText('#4', hidden)).toBeNull();
  });
});
