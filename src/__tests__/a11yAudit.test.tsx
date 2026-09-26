import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BookHeader } from '@/components/book/BookHeader';
import type { CandidateCardData } from '@/components/book/CandidateCard';
import { CandidateList } from '@/components/book/CandidateList';
import { editionLabel } from '@/components/scan/EditionRow';
import { Button, ConfirmDialog, Menu, Sheet, Stamp } from '@/components/ui';
import type { BookDetail } from '@/domain';
import { hostsWithRole, renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
import { ThemeProvider } from '@/theme';


/** Fixes from the P09-01 accessibility audit that a component test can hold in place. */

const candidate = (title: string, coverUrl: string | null): CandidateCardData => ({
  kind: 'edition',
  title,
  subtitle: null,
  authors: ['Terry Pratchett'],
  publisher: 'Corgi',
  publicationYear: 1985,
  pageCount: 285,
  isbn13: '9780552124751',
  isbn10: null,
  language: 'en',
  format: 'paperback',
  coverUrl,
  source: 'openlibrary',
} as CandidateCardData);

describe('lookup results', () => {
  it('are a list of cards only: the announced count and Show more sit outside it', () => {
    const cards = Array.from({ length: 7 }, (_, i) => candidate(`Book ${i + 1}`, null));
    renderWithTheme(<CandidateList candidates={cards} onChoose={jest.fn()} label="7 matches" />);
    const [list, ...others] = hostsWithRole(screen.UNSAFE_root, 'list');
    expect(others).toHaveLength(0);
    expect(list!.props['aria-label']).toBe('7 matches');
    expect(hostsWithRole(list!, 'listitem')).toHaveLength(5);
    const count = screen.getByText('7 matches');
    expect(count.props['aria-live']).toBe('polite');
    expect(list).not.toContainElement(count);
    expect(list).not.toContainElement(screen.getByTestId(Testids.lookup.showMore));
  });
});

describe('edition picker', () => {
  it('says whether an edition has a cover picture to compare, since the cover is how a sighted reader spots theirs', () => {
    expect(editionLabel(candidate('The Colour of Magic', 'https://covers.openlibrary.org/b/id/1-M.jpg'))).toMatch(/, with a cover picture$/);
    expect(editionLabel(candidate('The Colour of Magic', null))).toMatch(/, no cover picture$/);
  });
});

describe('modals', () => {
  it('keep the scrim out of the keyboard order', () => {
    renderWithTheme(
      <>
        <Sheet visible title="Lend" onClose={jest.fn()}>
          {null}
        </Sheet>
        <ConfirmDialog visible title="Remove?" onConfirm={jest.fn()} onCancel={jest.fn()} />
        <Menu visible onClose={jest.fn()} accessibilityLabel="More" items={[{ label: 'Edit', onPress: jest.fn() }]} />
      </>,
    );
    const scrims = screen.UNSAFE_root.findAll((n) => n.props.tabIndex === -1 && n.props['aria-hidden'] === true && typeof n.props.onPress === 'function');
    expect(scrims.length).toBeGreaterThanOrEqual(3);
  });
});

describe('large text', () => {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const atScale = (fontScale: number, ui: React.ReactElement) =>
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider scheme="light" fontScale={fontScale}>
          {ui}
        </ThemeProvider>
      </SafeAreaProvider>,
    );

  it('lets a button label wrap instead of running off the screen', () => {
    renderWithTheme(<Button label="Show the welcome tour" onPress={jest.fn()} testID="b" />);
    expect(screen.getByTestId('b')).toHaveStyle({ maxWidth: '100%' });
    expect(screen.getByText('Show the welcome tour')).toHaveStyle({ flexShrink: 1, textAlign: 'center' });
  });

  it('keeps a stamp inside its column, tilt included, so a long one wraps', () => {
    renderWithTheme(<Stamp label="On loan · Priya · Overdue · 5 days" testID="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ maxWidth: '94%' });
  });

  it('puts one book fact per line at 200 % text, two side by side at 100 %', () => {
    const book = { id: 1, title: 'Mort', subtitle: null, authors: [], genres: [], publisher: 'Corgi', publicationYear: 1987 } as unknown as BookDetail;
    const firstFact = () => {
      const facts = screen.getByTestId(Testids.bookDetail.facts);
      return facts.findAll((n) => typeof n.type === 'string' && n !== facts)[0]!;
    };
    atScale(1, <BookHeader book={book} />);
    expect(firstFact()).toHaveStyle({ flexBasis: 120, minWidth: 120 });
    screen.unmount();
    atScale(2, <BookHeader book={book} />);
    expect(firstFact()).toHaveStyle({ flexBasis: 240, minWidth: 240 });
  });
});

