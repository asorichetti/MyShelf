import { fireEvent, screen } from '@testing-library/react-native';

import { neighbourText, placeText, SeriesSection, type SeriesSectionProps } from '@/components/book/SeriesSection';
import type { Book } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const book = (id: number, title: string, seriesPosition: number | null) => ({ id, title, seriesPosition }) as Book;

function renderSection(props: Partial<SeriesSectionProps> = {}) {
  const onOpenSeries = jest.fn();
  const onOpenBook = jest.fn();
  renderWithTheme(
    <SeriesSection
      series={{ id: 1, name: 'Discworld', totalCount: 9 }}
      position={5}
      progress={{ owned: 5, total: 9, gaps: [6, 7, 8, 9], maxPosition: 5, complete: false }}
      neighbours={{ previous: { kind: 'owned', book: book(4, 'Mort', 4) }, next: { kind: 'missing', position: 6 } }}
      bookCount={5}
      onOpenSeries={onOpenSeries}
      onOpenBook={onOpenBook}
      {...props}
    />,
  );
  return { onOpenSeries, onOpenBook };
}

describe('placeText and neighbourText', () => {
  it('reads "Book 5 of 9", or "Book 5" without a total', () => {
    expect(placeText(5, 9)).toBe('Book 5 of 9');
    expect(placeText(2.5, null)).toBe('Book 2.5');
    expect(placeText(null, 9)).toBe('Not numbered in the series');
  });
  it('names the owned neighbour or the missing number', () => {
    expect(neighbourText({ kind: 'owned', book: book(1, 'Mort', 4) })).toBe('Mort (#4)');
    expect(neighbourText({ kind: 'missing', position: 6 })).toBe('#6 isn’t on your shelf yet');
  });
});

describe('SeriesSection', () => {
  it('shows the place, progress, previous and next', () => {
    renderSection();
    expect(screen.getByTestId(Testids.bookSeries.place)).toHaveTextContent('Book 5 of 9');
    expect(screen.getByText('5 of 9 owned, 4 missing')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.bookSeries.previous)).toHaveTextContent(/Previous: Mort \(#4\)/);
    expect(screen.getByTestId(Testids.bookSeries.next)).toHaveTextContent(/Next: #6 isn’t on your shelf yet/);
  });

  it('links to the series and to an owned neighbour, but not to a missing one', () => {
    const { onOpenSeries, onOpenBook } = renderSection();
    fireEvent.press(screen.getByTestId(Testids.bookSeries.link));
    expect(onOpenSeries).toHaveBeenCalled();
    expect(screen.getByTestId(Testids.bookSeries.link)).toHaveProp('accessibilityLabel', 'Discworld: see the whole series');
    fireEvent.press(screen.getByTestId(Testids.bookSeries.previous));
    expect(onOpenBook).toHaveBeenCalledWith(4);
    expect(screen.getByTestId(Testids.bookSeries.previous)).toHaveProp('accessibilityLabel', 'Previous in the series: Mort (#4)');
    expect(screen.getByTestId(Testids.bookSeries.next).props.role).toBeUndefined();
  });

  it('leaves out previous and next at the ends', () => {
    renderSection({ neighbours: { previous: null, next: null } });
    expect(screen.queryByTestId(Testids.bookSeries.previous)).toBeNull();
    expect(screen.queryByTestId(Testids.bookSeries.next)).toBeNull();
  });

  it('shows a confirmation passed in as children under the heading', () => {
    renderSection({ children: <></> });
    expect(screen.getByRole('heading', { name: 'Series' })).toBeOnTheScreen();
  });
});
