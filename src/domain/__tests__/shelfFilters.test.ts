import {
  activeFilterCount,
  filterChips,
  hasActiveFilters,
  noFilters,
  parseShelfFilters,
  toggleIn,
  yearRangeLabel,
  type ShelfFilters,
} from '../shelfFilters';

const f = (patch: Partial<ShelfFilters>): ShelfFilters => ({ ...noFilters, ...patch });

describe('parseShelfFilters', () => {
  it('keeps valid values', () => {
    const value = f({ genreIds: [3, 1], formats: ['ebook'], languages: ['fr'], loan: 'atHome', series: 'inSeries', yearFrom: 1900, yearTo: 2000, recentlyAdded: true });
    expect(parseShelfFilters(value)).toEqual(value);
  });

  it('falls back to "no filter" for anything invalid', () => {
    expect(parseShelfFilters(null)).toEqual(noFilters);
    expect(parseShelfFilters('fantasy')).toEqual(noFilters);
    expect(parseShelfFilters([1, 2])).toEqual(noFilters);
    expect(
      parseShelfFilters({ genreIds: [1, 'x', -2, 1.5, 1], formats: ['scroll', 'paperback'], languages: ['english', 'de', 3], loan: 'lost', series: 7, yearFrom: 'old', yearTo: 1e9, recentlyAdded: 'yes' }),
    ).toEqual(f({ genreIds: [1], formats: ['paperback'], languages: ['de'] }));
  });

  it('swaps a reversed year range', () => {
    expect(parseShelfFilters({ yearFrom: 2000, yearTo: 1990 })).toMatchObject({ yearFrom: 1990, yearTo: 2000 });
  });
});

describe('filter chips', () => {
  const names: Record<number, string> = { 1: 'Fantasy', 2: 'Mystery' };

  it('counts active filters', () => {
    expect(activeFilterCount(noFilters)).toBe(0);
    expect(hasActiveFilters(noFilters)).toBe(false);
    expect(activeFilterCount(f({ genreIds: [1, 2], loan: 'onLoan', yearTo: 1990 }))).toBe(4);
  });

  it('lists one chip per filter, each removing only itself', () => {
    const filters = f({ genreIds: [1, 2], formats: ['hardcover'], languages: ['fr'], loan: 'onLoan', series: 'standalone', yearFrom: 1950, yearTo: 1999, recentlyAdded: true });
    const chips = filterChips(filters, (id) => names[id], (code) => (code === 'fr' ? 'French' : code));
    expect(chips.map((c) => c.label)).toEqual(['Fantasy', 'Mystery', 'Hardback', 'French', 'On loan', 'Standalone', '1950–1999', 'Added in the last 30 days']);
    expect(chips[0].without.genreIds).toEqual([2]);
    expect(chips[4].without).toEqual({ ...filters, loan: 'any' });
    expect(chips[6].without).toMatchObject({ yearFrom: null, yearTo: null });
    expect(new Set(chips.map((c) => c.key)).size).toBe(chips.length);
  });

  it('labels year ranges', () => {
    expect(yearRangeLabel(1950, null)).toBe('From 1950');
    expect(yearRangeLabel(null, 1999)).toBe('Up to 1999');
    expect(yearRangeLabel(1987, 1987)).toBe('Published 1987');
  });

  it('toggles values in a list', () => {
    expect(toggleIn([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleIn([1, 2], 1)).toEqual([2]);
  });
});
