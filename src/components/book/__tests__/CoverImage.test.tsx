import { act, screen, within } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { COVER_FADE_MS, CoverImage } from '@/components/book/CoverImage';
import { GeneratedCover } from '@/components/book/GeneratedCover';
import { hashColour } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
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
  const q = { includeHiddenElements: true };

  it('without a URI shows the generated cover only', async () => {
    renderWithTheme(<CoverImage title="Dune" />);
    await settle();
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.getByTestId(Testids.cover.fallback, q)).toBeTruthy();
  });

  it('shows the real cover, fitted whole (contain), with a soft placeholder until it loads', async () => {
    renderWithTheme(<CoverImage title="Dune" uri="https://covers.example/dune.jpg" size="medium" />);
    await settle();
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://covers.example/dune.jpg' });
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.alt).toBe('');
    expect(screen.getByTestId(Testids.cover.placeholder, q)).toBeTruthy();
    expect(screen.queryByTestId(Testids.cover.fallback, q)).toBeNull();
    act(() => image.props.onLoad({ source: { width: 320, height: 500 } }));
    // The stand-in stays under the cover until its fade-in has finished.
    expect(screen.getByTestId(Testids.cover.placeholder, q)).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, COVER_FADE_MS + 20));
    });
    expect(screen.queryByTestId(Testids.cover.placeholder, q)).toBeNull();
    expect(screen.UNSAFE_getByType(Image)).toBeTruthy();
  });

  it('shows the generated cover as the loading stand-in, not a blank tile', async () => {
    renderWithTheme(<CoverImage title="Dune" author="Frank Herbert" uri="https://covers.example/dune.jpg" size="medium" />);
    await settle();
    const placeholder = screen.getByTestId(Testids.cover.placeholder, q);
    expect(within(placeholder).UNSAFE_getByType(GeneratedCover).props).toMatchObject({ title: 'Dune', author: 'Frank Herbert' });
  });

  it.each([
    ['a 1x1 "no cover" GIF', { width: 1, height: 1 }],
    ['a 9px sliver', { width: 300, height: 9 }],
  ])('treats %s that loads as a missing cover and shows the generated cover', async (_, source) => {
    renderWithTheme(<CoverImage title="Dune" uri="https://covers.openlibrary.org/b/id/0-L.jpg" />);
    await settle();
    act(() => screen.UNSAFE_getByType(Image).props.onLoad({ source }));
    expect(screen.queryByTestId(Testids.cover.image, q)).toBeNull();
    expect(screen.getByTestId(Testids.cover.fallback, q)).toBeTruthy();
  });

  it('keeps a real cover when the load event carries no size', async () => {
    renderWithTheme(<CoverImage title="Dune" uri="https://covers.example/dune.jpg" />);
    await settle();
    act(() => screen.UNSAFE_getByType(Image).props.onLoad({}));
    expect(screen.getByTestId(Testids.cover.image, q)).toBeTruthy();
    expect(screen.queryByTestId(Testids.cover.fallback, q)).toBeNull();
  });

  it('fades the cover in, unless reduce motion is on', async () => {
    renderWithTheme(<CoverImage title="Dune" uri="file:///covers/1.jpg" />);
    await settle();
    expect(screen.UNSAFE_getByType(Image).props.transition).toBe(COVER_FADE_MS);
  });

  it('falls back to the generated cover when the image fails, without logging errors', async () => {
    const error = jest.spyOn(console, 'error');
    renderWithTheme(<CoverImage title="Dune" uri="file:///missing.jpg" />);
    await settle();
    act(() => screen.UNSAFE_getByType(Image).props.onError({ error: 'not found' }));
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    expect(screen.getByTestId(Testids.cover.fallback, q)).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('tries again when the URI changes after a failure', async () => {
    const { rerender } = renderWithTheme(<CoverImage title="Dune" uri="file:///missing.jpg" />);
    await settle();
    act(() => screen.UNSAFE_getByType(Image).props.onError({ error: 'not found' }));
    rerender(<CoverImage title="Dune" uri="file:///found.jpg" />);
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: 'file:///found.jpg' });
  });

  it('keeps the 2:3 frame for every size', async () => {
    renderWithTheme(<CoverImage title="Dune" uri="https://x/y.jpg" size="large" testID="c" />);
    await settle();
    expect(screen.getByTestId('c', q)).toHaveStyle({ width: 200, height: 300 });
  });

  it('is hidden from assistive tech by default, or a labelled image when it stands alone', async () => {
    const { rerender } = renderWithTheme(<CoverImage title="Dune" testID="c" />);
    await settle();
    expect(screen.getByTestId('c', q).props['aria-hidden']).toBe(true);
    rerender(<CoverImage title="Dune" testID="c" decorative={false} />);
    await settle();
    expect(screen.getByRole('img', { name: 'Cover of Dune' })).toBeOnTheScreen();
  });
});
