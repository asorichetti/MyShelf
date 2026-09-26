import { groupIconOf, moveItem, validateGroupName } from '../groupIcons';
import { parseShelfGroupBy, parseShelfSort, parseShelfViewMode, sectionHeading, sectionLabel } from '../shelfView';

describe('shelf view preferences', () => {
  it('accept known values and reject the rest', () => {
    expect(parseShelfGroupBy('genre')).toBe('genre');
    expect(parseShelfGroupBy('colour')).toBeNull();
    expect(parseShelfViewMode('spines')).toBe('spines');
    expect(parseShelfViewMode(3)).toBeNull();
    expect(parseShelfSort({ sort: 'year', direction: 'desc' })).toEqual({ sort: 'year', direction: 'desc' });
    expect(parseShelfSort({ sort: 'colour', direction: 'desc' })).toBeNull();
    expect(parseShelfSort({ sort: 'year', direction: 'up' })).toBeNull();
    expect(parseShelfSort(null)).toBeNull();
  });

  it('words section headers', () => {
    expect(sectionHeading('Fantasy', 23)).toBe('Fantasy · 23');
    expect(sectionLabel('Fantasy', 23)).toBe('Fantasy, 23 books');
    expect(sectionLabel('Mystery', 1)).toBe('Mystery, 1 book');
  });
});

describe('groups', () => {
  it('fall back to the bookmark icon for unknown ones', () => {
    expect(groupIconOf('heart')).toBe('heart');
    expect(groupIconOf('beach')).toBe('bookmark');
    expect(groupIconOf(null)).toBe('bookmark');
  });

  it('need a short, non-blank name', () => {
    expect(validateGroupName('Favourites')).toBeNull();
    expect(validateGroupName('   ')).toBe('Give the group a name.');
    expect(validateGroupName('x'.repeat(41))).toMatch(/under 41/);
  });

  it('move items up and down, clamped to the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 5)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a'], 3, 0)).toEqual(['a']);
  });
});
