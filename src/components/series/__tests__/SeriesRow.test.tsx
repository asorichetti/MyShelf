import { fireEvent, screen } from '@testing-library/react-native';

import { SeriesRow } from '@/components/series/SeriesRow';
import { progressSentence, progressText, seriesLabel, type SeriesCounts } from '@/components/series/seriesText';
import type { SeriesSummary } from '@/db';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const discworld: SeriesSummary = {
  id: 1,
  name: 'Discworld',
  totalCount: 9,
  bookCount: 7,
  owned: 7,
  maxPosition: 9,
  total: 9,
  missing: 2,
  gaps: [3, 6],
  lastAddedAt: null,
};

describe('series text', () => {
  const counts = (patch: Partial<SeriesCounts>): SeriesCounts => ({ name: 'Discworld', owned: 5, total: 9, missing: 2, bookCount: 5, totalCount: 9, ...patch });
  it('reads "5 of 9 owned, 2 missing"', () => {
    expect(seriesLabel(counts({}))).toBe('Discworld, 5 of 9 owned, 2 missing');
    expect(progressText(counts({}))).toBe('5 of 9');
  });
  it('says complete, none missing so far, or not numbered', () => {
    expect(progressSentence(counts({ owned: 9, missing: 0 }))).toBe('9 of 9 owned, complete');
    expect(progressSentence(counts({ owned: 4, total: 4, missing: 0, totalCount: null }))).toBe('4 of 4 owned, none missing so far');
    expect(progressSentence(counts({ total: null, bookCount: 2, owned: 0, missing: 0 }))).toBe('2 books, not numbered');
    expect(progressText(counts({ total: null, bookCount: 0 }))).toBe('No books yet');
  });
});

describe('SeriesRow', () => {
  it('is a link named "Discworld, 7 of 9 owned, 2 missing" with a mini shelf', () => {
    const onPress = jest.fn();
    renderWithTheme(<SeriesRow series={discworld} onPress={onPress} />);
    const row = screen.getByTestId(Testids.seriesList.row);
    expect(row).toHaveProp('accessibilityLabel', 'Discworld, 7 of 9 owned, 2 missing');
    expect(row.props.role).toBe('link');
    expect(screen.getByText('7 of 9')).toBeOnTheScreen();
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledWith(1);
  });

  it('draws one spine per position, dashed for the gaps', () => {
    const { toJSON } = renderWithTheme(<SeriesRow series={discworld} onPress={() => {}} />);
    const json = JSON.stringify(toJSON());
    expect(json.match(/"borderStyle":"dashed"/g)).toHaveLength(2);
  });

  it('marks a complete series', () => {
    renderWithTheme(<SeriesRow series={{ ...discworld, owned: 9, missing: 0, gaps: [], bookCount: 9 }} onPress={() => {}} />);
    expect(screen.getByText('Complete!')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.seriesList.row)).toHaveProp('accessibilityLabel', 'Discworld, 9 of 9 owned, complete');
  });
});
