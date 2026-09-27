/**
 * @jest-environment node
 */
import { groupsRepo, shelfSectionsRepo, type Db, type ShelfSection } from '@/db';
import { noFilters, sortPreset, type ShelfGroupBy, type ShelfSort } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { oneKey } from '@/testing/sorts';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const list = (groupBy: ShelfGroupBy, extra: { query?: string; sort?: ShelfSort } = {}) =>
  shelfSectionsRepo.listShelfSections(db, { groupBy, sort: extra.sort ?? oneKey('title'), query: extra.query });

const summary = (sections: ShelfSection[]) => sections.map((s) => [s.sectionTitle, s.items.length]);
const titles = (s: ShelfSection | undefined) => s?.items.map((i) => i.title);

describe('listShelfSections', () => {
  it('is one untitled section when not grouped', async () => {
    const { sections, count } = await list('none');
    expect(count).toBe(12);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ sectionKey: 'all', sectionTitle: '', id: null });
    expect(sections[0].items).toHaveLength(12);
  });

  it('groups by genre A-Z with counts matching demo; a book with two genres is in both', async () => {
    const { sections, count } = await list('genre');
    expect(summary(sections)).toEqual([
      ['Classics', 2],
      ['Fantasy', 6],
      ['Mystery', 3],
      ['Science Fiction', 2],
    ]);
    expect(count).toBe(12);
    const hound = 'The Hound of the Baskervilles';
    expect(titles(sections[0])).toContain(hound);
    expect(titles(sections[2])).toContain(hound);
    expect(new Set(sections.map((s) => s.sectionKey)).size).toBe(sections.length);
    expect(sections.every((s) => s.id != null)).toBe(true);
  });

  it('puts books without a genre last under "No genre"', async () => {
    await db.run("INSERT INTO books (title) VALUES ('Untagged')");
    const { sections } = await list('genre');
    expect(sections.at(-1)).toMatchObject({ sectionKey: 'genre:none', sectionTitle: 'No genre', id: null });
    expect(titles(sections.at(-1))).toEqual(['Untagged']);
  });

  it('groups by series A-Z, standalones last; the sort applies inside each series', async () => {
    const { sections } = await list('series', { sort: oneKey('year', 'desc') });
    expect(summary(sections)).toEqual([
      ['Discworld', 3],
      ['Earthsea', 2],
      ['Not in a series', 7],
    ]);
    expect(titles(sections[0])).toEqual(['Mort', 'The Light Fantastic', 'The Colour of Magic']);
    expect(titles(sections[1])).toEqual(['The Farthest Shore', 'A Wizard of Earthsea']);
    expect(titles(sections[2])?.[0]).toBe('Good Omens');
  });

  it('series reading order inside series sections: the series level is skipped, the number decides', async () => {
    const { sections, skipped } = await list('series', { sort: { levels: sortPreset('seriesOrder').levels } });
    expect(skipped).toEqual({ key: 'series', direction: 'asc' });
    expect(titles(sections[0])).toEqual(['The Colour of Magic', 'The Light Fantastic', 'Mort']);
    expect(titles(sections[1])).toEqual(['A Wizard of Earthsea', 'The Farthest Shore']);
  });

  it('groups by author A-Z by sort name; co-written books appear under each author', async () => {
    const { sections } = await list('author');
    expect(summary(sections)).toEqual([
      ['Jane Austen', 1],
      ['Agatha Christie', 2],
      ['Arthur Conan Doyle', 1],
      ['Neil Gaiman', 1],
      ['Frank Herbert', 1],
      ['Ursula K. Le Guin', 3],
      ['Terry Pratchett', 4],
    ]);
    expect(titles(sections[3])).toEqual(['Good Omens']);
  });

  it('groups by user group, with the rest under "Not in a group"', async () => {
    await groupsRepo.createGroup(db, { name: 'Empty group' });
    const { sections } = await list('group');
    expect(summary(sections)).toEqual([
      ['Holiday reads', 3],
      ['Not in a group', 9],
    ]);
  });

  it('applies the search within sections and drops sections left empty', async () => {
    const { sections, count } = await list('genre', { query: 'prat' });
    expect(count).toBe(4);
    expect(summary(sections)).toEqual([['Fantasy', 4]]);
  });

  it('applies the sort within sections', async () => {
    const { sections } = await list('genre', { sort: oneKey('year') });
    expect(titles(sections[1])).toEqual([
      'A Wizard of Earthsea',
      'The Farthest Shore',
      'The Colour of Magic',
      'The Light Fantastic',
      'Mort',
      'Good Omens',
    ]);
  });

  it('applies filters', async () => {
    const [fantasy] = (await db.all<{ id: number }>("SELECT id FROM genres WHERE name = 'Fantasy'")).map((r) => r.id);
    const { sections, count } = await shelfSectionsRepo.listShelfSections(db, {
      groupBy: 'series',
      sort: oneKey('title'),
      filters: { ...noFilters, genreIds: [fantasy], series: 'standalone' },
    });
    expect(count).toBe(1);
    expect(summary(sections)).toEqual([['Not in a series', 1]]);
  });

  it('uses a bounded number of queries', async () => {
    await list('author');
    const all = jest.spyOn(db, 'all');
    const get = jest.spyOn(db, 'get');
    await list('author');
    // The stored sort keys' check, the books (with their authors), the memberships.
    expect(all.mock.calls.length + get.mock.calls.length).toBe(3);
    all.mockRestore();
    get.mockRestore();
  });
});
