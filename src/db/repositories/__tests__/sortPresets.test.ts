/**
 * @jest-environment node
 */
import { booksRepo, shelfSectionsRepo, type Db } from '@/db';
import { sortKeyRegistry } from '@/db/sortKeys';
import { applyPreset, describeSort as describeLevels, sortPreset, type ShelfGroupBy, type ShelfSort, type SortLevel, type SortPresetId } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { levels } from '@/testing/sorts';

const describeSort = (l: readonly SortLevel[], g?: ShelfGroupBy) => describeLevels(l, sortKeyRegistry, g);

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterAll(() => db.close());

const titles = async (sort: ShelfSort) => (await booksRepo.listBookItems(db, { sort })).map((b) => b.title);
const preset = (id: SortPresetId) => applyPreset(sortPreset(id).levels, () => 0.25);

/** Every preset on the demo library, in full. */
describe('presets on the demo library', () => {
  it('Library order: genre, then author, then series, then number in series, then title', async () => {
    expect(await titles(preset('library'))).toEqual([
      // Classics: Austen, Conan Doyle (The Hound is Mystery and Classics: Classics comes first)
      'Pride and Prejudice',
      'The Hound of the Baskervilles',
      // Fantasy: Le Guin's Earthsea #1, #3; Pratchett's Discworld #1, #2, #4, then Good Omens (no series)
      'A Wizard of Earthsea',
      'The Farthest Shore',
      'The Colour of Magic',
      'The Light Fantastic',
      'Mort',
      'Good Omens',
      // Mystery: Christie, by title ("Murder of…" before "Murder on…")
      'The Murder of Roger Ackroyd',
      'Murder on the Orient Express',
      // Science Fiction: Herbert, Le Guin
      'Dune',
      'The Left Hand of Darkness',
    ]);
  });

  it('Series reading order: each series in order, standalones by title after', async () => {
    expect(await titles(preset('seriesOrder'))).toEqual([
      'The Colour of Magic',
      'The Light Fantastic',
      'Mort',
      'A Wizard of Earthsea',
      'The Farthest Shore',
      'Dune',
      'Good Omens',
      'The Hound of the Baskervilles',
      'The Left Hand of Darkness',
      'The Murder of Roger Ackroyd',
      'Murder on the Orient Express',
      'Pride and Prejudice',
    ]);
  });

  it('Call number: class, author mark, year', async () => {
    expect(await titles(preset('callNumber'))).toEqual([
      'Pride and Prejudice', // FIC AUS 1813
      'The Murder of Roger Ackroyd', // FIC CHR 1926
      'Murder on the Orient Express', // FIC CHR 1934
      'The Hound of the Baskervilles', // FIC DOY 1902
      'Dune', // FIC HER 1965
      'A Wizard of Earthsea', // FIC LEG 1968
      'The Left Hand of Darkness', // FIC LEG 1969
      'The Farthest Shore', // FIC LEG 1972
      'The Colour of Magic', // FIC PRA 1983
      'The Light Fantastic', // FIC PRA 1986
      'Mort', // FIC PRA 1987
      'Good Omens', // FIC PRA 1990
    ]);
  });

  it('Newest additions: the last book added first', async () => {
    const order = await titles(preset('newest'));
    expect(order[0]).toBe('Pride and Prejudice');
    expect(order.at(-1)).toBe('The Colour of Magic');
  });

  it('A–Z by title', async () => {
    expect((await titles(preset('titleAZ'))).slice(0, 3)).toEqual(['The Colour of Magic', 'Dune', 'The Farthest Shore']);
  });

  it('By author: author, series, number in series, year', async () => {
    expect(await titles(preset('byAuthor'))).toEqual([
      'Pride and Prejudice',
      'The Murder of Roger Ackroyd', // 1926
      'Murder on the Orient Express', // 1934
      'The Hound of the Baskervilles',
      'Dune',
      'A Wizard of Earthsea', // Earthsea #1
      'The Farthest Shore', // Earthsea #3
      'The Left Hand of Darkness', // no series
      'The Colour of Magic',
      'The Light Fantastic',
      'Mort',
      'Good Omens',
    ]);
  });

  it('Rainbow: every book, each colour together', async () => {
    const order = await titles(preset('rainbow'));
    expect(order).toHaveLength(12);
    expect(new Set(order).size).toBe(12);
  });

  it('Surprise me: stable for its seed, different for another', async () => {
    const a = await titles({ levels: levels(['shuffle']), seed: 101 });
    expect(await titles({ levels: levels(['shuffle']), seed: 101 })).toEqual(a);
    expect(await titles({ levels: levels(['shuffle']), seed: 202 })).not.toEqual(a);
    expect([...a].sort()).toEqual([...(await titles(preset('titleAZ')))].sort());
  });
});

describe('sorting within sections', () => {
  const sections = async (groupBy: 'genre' | 'series' | 'author' | 'group', sort: ShelfSort) =>
    (await shelfSectionsRepo.listShelfSections(db, { groupBy, sort })).sections.map((s) => [s.sectionTitle, s.items.map((i) => i.title)]);

  it('Library order grouped by genre: genre orders the sections and is skipped inside them', async () => {
    const result = await shelfSectionsRepo.listShelfSections(db, { groupBy: 'genre', sort: preset('library') });
    expect(result.skipped).toEqual({ key: 'genre', direction: 'asc' });
    expect(result.sections.map((s) => [s.sectionTitle, s.items.map((i) => i.title)])).toEqual([
      ['Classics', ['Pride and Prejudice', 'The Hound of the Baskervilles']],
      ['Fantasy', ['A Wizard of Earthsea', 'The Farthest Shore', 'The Colour of Magic', 'The Light Fantastic', 'Mort', 'Good Omens']],
      // Inside Mystery the Hound sorts by author (Doyle) — its primary genre does not matter here.
      ['Mystery', ['The Murder of Roger Ackroyd', 'Murder on the Orient Express', 'The Hound of the Baskervilles']],
      ['Science Fiction', ['Dune', 'The Left Hand of Darkness']],
    ]);
  });

  it('genre Z to A as the first level reverses the sections', async () => {
    const got = await sections('genre', { levels: levels(['genre', 'desc'], ['title']) });
    expect(got.map(([t]) => t)).toEqual(['Science Fiction', 'Mystery', 'Fantasy', 'Classics']);
  });

  it('a sort that does not start with the grouping applies as it is inside every section', async () => {
    const got = await sections('genre', { levels: levels(['year', 'desc']) });
    expect(got[1]).toEqual(['Fantasy', ['Good Omens', 'Mort', 'The Light Fantastic', 'The Colour of Magic', 'The Farthest Shore', 'A Wizard of Earthsea']]);
  });

  it('grouped by author, By author skips the author and orders each author’s books by series, number and year', async () => {
    const got = await sections('author', preset('byAuthor'));
    expect(got.find(([t]) => t === 'Terry Pratchett')).toEqual(['Terry Pratchett', ['The Colour of Magic', 'The Light Fantastic', 'Mort', 'Good Omens']]);
    expect(got.find(([t]) => t === 'Agatha Christie')).toEqual(['Agatha Christie', ['The Murder of Roger Ackroyd', 'Murder on the Orient Express']]);
  });

  it('describes the skipped level in the summary', () => {
    expect(describeSort(sortPreset('library').levels, 'genre')).toBe('Genre (as sections), then Author, then Series, then Number in series');
    expect(describeSort(sortPreset('library').levels, 'none')).toBe('Genre, then Author, then Series, then Number in series');
    expect(describeSort(levels(['genre', 'desc'], ['added']), 'genre')).toBe('Genre (as sections, Z to A), then Date added (Oldest first)');
    expect(describeSort(levels(['shuffle']))).toBe('Surprise me');
  });
});
