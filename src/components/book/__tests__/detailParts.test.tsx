import { fireEvent, screen } from '@testing-library/react-native';

import { bookFacts, creditLine } from '@/components/book/BookHeader';
import { CallNumber } from '@/components/book/CallNumber';
import { GenreChips } from '@/components/book/GenreChips';
import { SUMMARY_COLLAPSE_CHARS, SummaryText } from '@/components/book/SummaryText';
import type { BookDetail } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { lightTheme } from '@/theme';

describe('SummaryText', () => {
  it('collapses long text and toggles with an announced state', () => {
    renderWithTheme(<SummaryText text={'x'.repeat(SUMMARY_COLLAPSE_CHARS + 1)} testID="s" />);
    expect(screen.getByTestId('s').props.numberOfLines).toBe(5);
    const toggle = screen.getByRole('button', { name: 'Read more of the summary' });
    expect(toggle).toBeCollapsed();
    fireEvent.press(toggle);
    expect(screen.getByRole('button', { name: 'Show less of the summary' })).toBeExpanded();
  });
});

describe('CallNumber and GenreChips', () => {
  it('types the call number in stamp lettering', () => {
    renderWithTheme(<CallNumber value="FIC PRA 1987" />);
    expect(screen.getByText('FIC PRA 1987')).toHaveStyle({ fontFamily: lightTheme.typography.stamp.fontFamily });
  });

  it('lists genres', () => {
    renderWithTheme(<GenreChips genres={['Fantasy', 'Humour']} testID="g" />);
    expect(screen.getByTestId('g').props.role).toBe('list');
    expect(screen.getByText('Fantasy')).toBeOnTheScreen();
    expect(screen.getByText('Humour')).toBeOnTheScreen();
  });
});

describe('BookHeader helpers', () => {
  it('notes roles other than author', () => {
    expect(
      creditLine([
        { id: 1, name: 'Roald Dahl', sortName: null, role: 'author', position: 0 },
        { id: 2, name: 'Quentin Blake', sortName: null, role: 'illustrator', position: 1 },
      ]),
    ).toBe('Roald Dahl and Quentin Blake (illustrator)');
  });

  it('lists only the facts that are present, in catalogue order', () => {
    const facts = bookFacts({ publisher: 'Ace', publicationYear: 1965, format: 'hardcover', language: 'fr', isbn13: null, isbn10: null } as BookDetail);
    expect(facts.map((f) => `${f.label}: ${f.value}`)).toEqual(['Publisher: Ace', 'Year: 1965', 'Format: Hardback', 'Language: French']);
  });
});
