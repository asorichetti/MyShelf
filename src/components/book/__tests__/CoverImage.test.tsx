import { act, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { CoverImage } from '@/components/book/CoverImage';
import { GeneratedCover } from '@/components/book/GeneratedCover';
import { hashColour } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { lightTheme } from '@/theme';

const cloth = (title: string) => lightTheme.covers[hashColour(title, lightTheme.covers.length)].cloth;

describe('GeneratedCover', () => {
  it('always binds the same title in the same colour', () => {
    const { rerender } = renderWithTheme(<GeneratedCover title="Dune" size="medium" testID="cover" />);
    const first = screen.getByTestId('cover', { includeHiddenElements: true });
    expect(first).toHaveStyle({ backgroundColor: cloth('Dune') });
    rerender(<GeneratedCover title="Dune" size="medium" testID="cover" />);
    expect(screen.getByTestId('cover', { includeHiddenElements: true })).toHaveStyle({ backgroundColor: cloth('Dune') });
  });

  it.each([
    ['thumb', 48, 72],
    ['medium', 120, 180],
    ['large', 200, 300],
  ] as const)('%s is %i x %i', (size, width, height) => {
    renderWithTheme(<GeneratedCover title="Mort" size={size} testID="cover" />);
    expect(screen.getByTestId('cover', { includeHiddenElements: true })).toHaveStyle({ width, height });
  });

  it('sets the title and author in Lora, or the initial on a thumbnail', () => {
    const { rerender } = renderWithTheme(<GeneratedCover title="The Hobbit" author="J. R. R. Tolkien" size="medium" />);
    expect(screen.getByText('The Hobbit', { includeHiddenElements: true })).toHaveStyle({ fontFamily: lightTheme.fonts.heading });
    expect(screen.getByText('J. R. R. Tolkien', { includeHiddenElements: true })).toBeTruthy();
    rerender(<GeneratedCover title="The Hobbit" size="thumb" />);
    expect(screen.getByText('H', { includeHiddenElements: true })).toBeTruthy();
  });
});

/** Lets useReducedMotion's async lookup settle inside act(). */
const settle = () => act(async () => {});

describe('CoverImage', () => {
  it('without a URI shows the generated cover only', async () => {
    renderWithTheme(<CoverImage title="Dune" />);
    await settle();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.UNSAFE_getAllByType(GeneratedCover)).toHaveLength(1);
  });

  it('shows the image over the generated placeholder', async () => {
    renderWithTheme(<CoverImage title="Dune" uri="https://covers.example/dune.jpg" size="medium" />);
    await settle();
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://covers.example/dune.jpg' });
    expect(image.props.alt).toBe('');
    expect(screen.UNSAFE_getAllByType(GeneratedCover)).toHaveLength(1);
  });

  it('falls back to the generated cover when the image fails, without logging errors', async () => {
    const error = jest.spyOn(console, 'error');
    renderWithTheme(<CoverImage title="Dune" uri="file:///missing.jpg" />);
    await settle();
    act(() => screen.UNSAFE_getByType(Image).props.onError({ error: 'not found' }));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.UNSAFE_getAllByType(GeneratedCover)).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('is hidden from assistive tech by default, or a labelled image when it stands alone', async () => {
    const { rerender } = renderWithTheme(<CoverImage title="Dune" testID="c" />);
    await settle();
    expect(screen.getByTestId('c', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
    rerender(<CoverImage title="Dune" testID="c" decorative={false} />);
    await settle();
    expect(screen.getByRole('img', { name: 'Cover of Dune' })).toBeOnTheScreen();
  });
});
