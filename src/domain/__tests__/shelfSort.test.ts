import {
  addSavedPreset,
  applyPreset,
  defaultShelfSort,
  deleteSavedPreset,
  flipLevel,
  isLegacySort,
  MAX_SAVED_PRESETS,
  MAX_SEED,
  MAX_SORT_LEVELS,
  matchingPreset,
  moveLevel,
  newPresetId,
  parseSavedPresets,
  parseShelfSort,
  parseSortLevels,
  presetName,
  presetNameProblem,
  removeLevel,
  renameSavedPreset,
  sectionSort,
  shuffleRank,
  sortPreset,
  sortPresets,
  type SavedSortPreset,
  type SortLevel,
} from '../shelfSort';

const lv = (...pairs: [SortLevel['key'], SortLevel['direction']?][]): SortLevel[] => pairs.map(([key, direction = 'asc']) => ({ key, direction }));

describe('parseShelfSort', () => {
  it('reads today’s shape', () => {
    expect(parseShelfSort({ levels: lv(['genre'], ['author', 'desc']) })).toEqual({ levels: lv(['genre'], ['author', 'desc']) });
  });

  it.each([
    [{ sort: 'title', direction: 'asc' }, lv(['title'])],
    [{ sort: 'title', direction: 'desc' }, lv(['title', 'desc'])],
    [{ sort: 'author', direction: 'asc' }, lv(['author'])],
    [{ sort: 'year', direction: 'desc' }, lv(['year', 'desc'])],
    [{ sort: 'added', direction: 'desc' }, lv(['added', 'desc'])],
    [{ sort: 'rating', direction: 'desc' }, lv(['rating', 'desc'])],
    [{ sort: 'rating', direction: 'asc' }, lv(['rating'])],
  ])('reads the single key saved before Phase 11 (%j) as the same order', (old, levels) => {
    expect(isLegacySort(old)).toBe(true);
    expect(parseShelfSort(old)).toEqual({ levels });
  });

  it('rejects what it cannot use', () => {
    expect(parseShelfSort(null)).toBeNull();
    expect(parseShelfSort('title')).toBeNull();
    expect(parseShelfSort({ sort: 'banana', direction: 'asc' })).toBeNull();
    expect(parseShelfSort({ sort: 'year', direction: 'sideways' })).toBeNull();
    expect(parseShelfSort({ levels: [] })).toBeNull();
    expect(parseShelfSort({ levels: [{ key: 'weight', direction: 'asc' }] })).toBeNull();
    expect(isLegacySort({ levels: lv(['title']) })).toBe(false);
  });

  it('drops bad or repeated levels and keeps at most four', () => {
    expect(parseSortLevels([{ key: 'genre', direction: 'asc' }, { key: 'genre', direction: 'desc' }, { key: 'x', direction: 'asc' }, 'junk', { key: 'year', direction: 'up' }])).toEqual(lv(['genre']));
    const five = lv(['genre'], ['author'], ['series'], ['seriesPosition'], ['title']);
    expect(parseSortLevels(five)).toHaveLength(MAX_SORT_LEVELS);
  });

  it('keeps a shuffle’s seed, and gives a shuffle saved without one a seed', () => {
    expect(parseShelfSort({ levels: lv(['shuffle']), seed: 42 })).toEqual({ levels: lv(['shuffle']), seed: 42 });
    const fresh = parseShelfSort({ levels: lv(['shuffle']), seed: -3 })!;
    expect(fresh.seed).toBeGreaterThan(0);
    expect(fresh.seed).toBeLessThan(MAX_SEED);
    // No shuffle, no seed.
    expect(parseShelfSort({ levels: lv(['title']), seed: 42 })).toEqual({ levels: lv(['title']) });
  });
});

describe('presets', () => {
  it('are the eight asked for, each at most four levels', () => {
    expect(sortPresets.map((p) => presetName(p))).toEqual(['Library order', 'Series reading order', 'Call number', 'Newest additions', 'A–Z by title', 'By author', 'Rainbow', 'Surprise me']);
    for (const p of sortPresets) expect(p.levels.length).toBeLessThanOrEqual(MAX_SORT_LEVELS);
  });

  it('library order is genre, author, series, number in series (title breaks the rest)', () => {
    expect(sortPreset('library').levels).toEqual(lv(['genre'], ['author'], ['series'], ['seriesPosition']));
    expect(sortPreset('byAuthor').levels).toEqual(lv(['author'], ['series'], ['seriesPosition'], ['year']));
    expect(sortPreset('newest').levels).toEqual(lv(['added', 'desc']));
  });

  it('Surprise me deals a new seed each time; others have none', () => {
    const rolls = [0.1, 0.9];
    const a = applyPreset(sortPreset('surprise').levels, () => rolls.shift()!);
    const b = applyPreset(sortPreset('surprise').levels, () => 0.5);
    expect(a.seed).not.toBe(b.seed);
    expect(applyPreset(sortPreset('library').levels)).toEqual({ levels: sortPreset('library').levels });
  });

  it('matches levels back to a preset (built-in first, then saved)', () => {
    const saved: SavedSortPreset[] = [{ id: 'p1', name: 'Mine', levels: lv(['pages', 'desc']) }];
    expect(presetName(matchingPreset(lv(['added', 'desc']), saved)!)).toBe('Newest additions');
    expect(presetName(matchingPreset(lv(['pages', 'desc']), saved)!)).toBe('Mine');
    expect(matchingPreset(lv(['pages']), saved)).toBeNull();
    expect(presetName(matchingPreset(defaultShelfSort.levels)!)).toBe('A–Z by title');
  });
});

describe('saved presets', () => {
  const one = addSavedPreset([], 'Reading pile', lv(['pages'], ['title']), 'p1');

  it('adds, renames and deletes', () => {
    expect(one).toEqual([{ id: 'p1', name: 'Reading pile', levels: lv(['pages'], ['title']) }]);
    const two = addSavedPreset(one, '  Gifts  ', lv(['publisher']), 'p2');
    expect(two.map((p) => p.name)).toEqual(['Reading pile', 'Gifts']);
    const renamed = renameSavedPreset(two, 'p2', 'Presents');
    expect(renamed.map((p) => p.name)).toEqual(['Reading pile', 'Presents']);
    expect(renamed[1].levels).toEqual(lv(['publisher']));
    expect(deleteSavedPreset(renamed, 'p1').map((p) => p.id)).toEqual(['p2']);
  });

  it('refuses empty, over-long and taken names (built-in ones too), and too many', () => {
    expect(presetNameProblem('  ', one)).toBe('empty');
    expect(presetNameProblem('x'.repeat(41), one)).toBe('tooLong');
    expect(presetNameProblem('reading PILE', one)).toBe('taken');
    expect(presetNameProblem('Library order', one)).toBe('taken');
    // Renaming a preset to its own name (another case) is fine.
    expect(presetNameProblem('READING PILE', one, 'p1')).toBeNull();
    const full = Array.from({ length: MAX_SAVED_PRESETS }, (_, i) => ({ id: `p${i}`, name: `P ${i}`, levels: lv(['title']) }));
    expect(presetNameProblem('One more', full)).toBe('full');
    expect(() => addSavedPreset(one, '', lv(['title']), 'p9')).toThrow();
  });

  it('parses stored presets, dropping broken ones', () => {
    expect(
      parseSavedPresets([
        { id: 'a', name: 'Good', levels: lv(['genre']) },
        { id: 'a', name: 'Duplicate id', levels: lv(['genre']) },
        { id: 'b', name: '', levels: lv(['genre']) },
        { id: 'c', name: 'No levels', levels: [] },
        'junk',
      ]),
    ).toEqual([{ id: 'a', name: 'Good', levels: lv(['genre']) }]);
    expect(parseSavedPresets('nope')).toEqual([]);
  });

  it('makes unique ids', () => {
    expect(newPresetId([], 36)).toBe('p10');
    expect(newPresetId([{ id: 'p10', name: 'x', levels: lv(['title']) }], 36)).toBe('p11');
  });
});

describe('editing levels', () => {
  const three = lv(['genre'], ['author'], ['series']);

  it('moves a level up or down, and not past the ends', () => {
    expect(moveLevel(three, 2, -1)).toEqual(lv(['genre'], ['series'], ['author']));
    expect(moveLevel(three, 0, 1)).toEqual(lv(['author'], ['genre'], ['series']));
    expect(moveLevel(three, 0, -1)).toEqual(three);
    expect(moveLevel(three, 2, 1)).toEqual(three);
  });

  it('removes a level but never the last one', () => {
    expect(removeLevel(three, 1)).toEqual(lv(['genre'], ['series']));
    expect(removeLevel(lv(['genre']), 0)).toEqual(lv(['genre']));
  });

  it('flips one level’s direction', () => {
    expect(flipLevel(three, 1)).toEqual(lv(['genre'], ['author', 'desc'], ['series']));
  });
});

describe('sectionSort', () => {
  it('skips a first level that is the grouping’s own key', () => {
    expect(sectionSort(lv(['genre'], ['author']), 'genre')).toEqual({ levels: lv(['author']), skipped: { key: 'genre', direction: 'asc' }, reverseSections: false });
    expect(sectionSort(lv(['series'], ['seriesPosition']), 'series').levels).toEqual(lv(['seriesPosition']));
    expect(sectionSort(lv(['group', 'desc']), 'group')).toEqual({ levels: lv(['title']), skipped: { key: 'group', direction: 'desc' }, reverseSections: true });
    // Rating sections run best first on their own: highest first keeps them, lowest first reverses them.
    expect(sectionSort(lv(['rating', 'desc'], ['title']), 'rating').reverseSections).toBe(false);
    expect(sectionSort(lv(['rating', 'asc'], ['title']), 'rating').reverseSections).toBe(true);
  });

  it('keeps every level otherwise', () => {
    expect(sectionSort(lv(['genre'], ['author']), 'author')).toEqual({ levels: lv(['genre'], ['author']), skipped: null, reverseSections: false });
    expect(sectionSort(lv(['author']), 'none')).toEqual({ levels: lv(['author']), skipped: null, reverseSections: false });
  });
});

describe('shuffleRank', () => {
  it('is a 32-bit number, fixed for an id and seed, and spreads consecutive ids', () => {
    expect(shuffleRank(1, 7)).toBe(shuffleRank(1, 7));
    const ranks = Array.from({ length: 200 }, (_, i) => shuffleRank(i + 1, 7));
    expect(ranks.every((r) => Number.isInteger(r) && r >= 0 && r < 2 ** 32)).toBe(true);
    expect(new Set(ranks).size).toBe(200);
    // Not simply increasing with the id.
    const ascending = ranks.filter((r, i) => i > 0 && r > ranks[i - 1]).length;
    expect(ascending).toBeGreaterThan(60);
    expect(ascending).toBeLessThan(140);
  });
});
