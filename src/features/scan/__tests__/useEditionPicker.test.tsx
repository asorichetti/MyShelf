import { act, renderHook, waitFor } from '@testing-library/react-native';

import { StaticDatabaseProvider, type Db } from '@/db';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { makeCandidate } from '@/services/metadata/candidate';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';

import { createSession, type ScanSession } from '../sessionStore';
import { enrichEdition, groupByWork, useEditionPicker } from '../useEditionPicker';

import type { ReactNode } from 'react';

let db: Db;
let metadata: FixtureMetadata;
beforeEach(async () => {
  db = await createTestDb();
  metadata = createFixtureMetadata();
});
afterEach(() => db.close());

function wrapper({ children }: { children: ReactNode }) {
  return <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;
}

const render = (session: ScanSession | null) => renderHook(() => useEditionPicker(session, { service: metadata.service }), { wrapper });

async function coverSession() {
  const { candidates } = await metadata.service.search({ text: 'the colour of magic terry pratchett' });
  return createSession({ source: 'cover', candidates });
}

describe('useEditionPicker (P03-08)', () => {
  it('a single ISBN result skips the grouping and starts selected', async () => {
    const { candidates } = await metadata.service.lookupIsbn(OL_BOOKS.colourOfMagic);
    const session = createSession({ source: 'barcode', isbn13: OL_BOOKS.colourOfMagic, candidates });
    const { result } = render(session);
    expect(result.current.single).toBe(candidates[0]);
    expect(result.current.groups).toEqual([]);
    expect(result.current.selected).toBe(candidates[0]);
    expect(result.current.chosen()).toBe(candidates[0]);
  });

  it('groups a cover search by work, the best match first, and selects nothing yet', async () => {
    const { result } = render(await coverSession());
    const groups = result.current.groups;
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0].work.title).toBe('The Colour of Magic');
    expect(groups[0].work.workKey).toBe('OL453657W');
    expect(result.current.selected).toBeNull();
    expect(result.current.chosen()).toBeNull();
  });

  it('opening a work loads its editions (loading first), with filters from what loaded', async () => {
    const { result } = render(await coverSession());
    const key = result.current.groups[0].key;
    act(() => result.current.toggle(key));
    expect(result.current.loads[key]).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.loads[key].status).toBe('ready'));
    const editions = result.current.editionsOf(key);
    expect(editions.length).toBeGreaterThan(10);
    expect(result.current.available.formats).toEqual(expect.arrayContaining(['paperback', 'audiobook']));
    expect(result.current.available.languages).toEqual(expect.arrayContaining(['en', 'fr']));

    act(() => result.current.setFilters({ format: 'paperback' }));
    expect(result.current.editionsOf(key).every((e) => e.format === 'paperback')).toBe(true);
    act(() => result.current.setFilters({ format: null, language: 'fr' }));
    expect(result.current.editionsOf(key).every((e) => e.language === 'fr')).toBe(true);
  });

  it('selecting an edition enables confirming, and the choice carries what its work knows', async () => {
    const { result } = render(await coverSession());
    const key = result.current.groups[0].key;
    act(() => result.current.toggle(key));
    await waitFor(() => expect(result.current.loads[key].status).toBe('ready'));
    const corgi = result.current.editionsOf(key).find((e) => e.isbn13 === '9780552124751')!;
    act(() => result.current.select(corgi));
    const chosen = result.current.chosen()!;
    expect(chosen).toMatchObject({ title: 'The Colour of Magic', publisher: 'Corgi', publicationYear: 1990, isbn13: '9780552124751', workKey: 'OL453657W' });
    expect(chosen.subjects.length).toBeGreaterThan(0);
    expect(chosen.seriesHints.some((h) => h.name?.startsWith('Discworld'))).toBe(true);
  });

  it('lists editions in the language read on the cover first, and that language first among the filters', async () => {
    const { candidates } = await metadata.service.search({ text: 'the colour of magic terry pratchett' });
    const french = createSession({ source: 'cover', candidates, language: { code: 'fr', detected: true } });
    const { result } = render(french);
    const key = result.current.groups[0].key;
    act(() => result.current.toggle(key));
    await waitFor(() => expect(result.current.loads[key].status).toBe('ready'));
    const editions = result.current.editionsOf(key);
    const firstOther = editions.findIndex((e) => e.language !== 'fr');
    expect(editions[0].language).toBe('fr');
    expect(editions.slice(firstOther).some((e) => e.language === 'fr')).toBe(false);
    expect(result.current.available.languages[0]).toBe('fr');
  });

  it("without a language read, prefers the app's (English) and editions with a cover", async () => {
    const { result } = render(await coverSession());
    const key = result.current.groups[0].key;
    act(() => result.current.toggle(key));
    await waitFor(() => expect(result.current.loads[key].status).toBe('ready'));
    const [first] = result.current.editionsOf(key);
    expect(first.language).toBe('en');
    expect(first.coverRefs.olEditionCoverIds.length).toBeGreaterThan(0);
  });

  it('the chosen edition carries the work cover and the other editions\' covers for the cover chain', async () => {
    const { result } = render(await coverSession());
    const key = result.current.groups[0].key;
    act(() => result.current.toggle(key));
    await waitFor(() => expect(result.current.loads[key].status).toBe('ready'));
    const bare = result.current.editionsOf(key).find((e) => !e.coverRefs.olEditionCoverIds.length)!;
    act(() => result.current.select(bare));
    const refs = result.current.chosen()!.coverRefs;
    expect(refs.olWorkCoverIds).toEqual(result.current.groups[0].work.coverRefs.olWorkCoverIds);
    expect(refs.olWorkCoverIds.length).toBeGreaterThan(0);
    expect(refs.olOtherEditionCoverIds?.length).toBeGreaterThan(0);
  });

  it('a work whose editions fail to load can be chosen itself', async () => {
    jest.spyOn(metadata.service, 'editionsPage').mockRejectedValue(new Error('down'));
    const { result } = render(await coverSession());
    const group = result.current.groups.find((g) => g.members.length === 0)!;
    act(() => result.current.toggle(group.key));
    await waitFor(() => expect(result.current.loads[group.key].status).toBe('error'));
    expect(result.current.editionsOf(group.key)).toEqual([group.work]);
  });

  describe('a work with more editions than one page', () => {
    async function newSpring() {
      const { candidates } = await metadata.service.search({ text: 'new spring robert jordan' });
      const { result } = render(createSession({ source: 'cover', candidates }));
      const key = result.current.groups[0].key;
      await waitFor(() => expect(result.current.loads[key].status).toBe('ready'));
      return { result, key };
    }
    const GRAPHIC_NOVEL = '9781606902080';

    it('loads the first 100, ranked, and says how many more there are', async () => {
      const { result, key } = await newSpring();
      expect(result.current.editionsOf(key)).toHaveLength(100);
      expect(result.current.loads[key]).toMatchObject({ status: 'ready', total: 130, loaded: 100, more: 'idle' });
      expect(result.current.hasMore(key)).toBe(true);
      expect(metadata.fixtures.calls.filter((u) => u.includes('/editions.json'))).toEqual(['https://openlibrary.org/works/OL99999W/editions.json?limit=100']);
    });

    it('"Show more editions" loads the next page, after the first, until all are loaded', async () => {
      const { result, key } = await newSpring();
      const first = result.current.editionsOf(key).map((e) => e.sourceId);
      act(() => result.current.loadMore(key));
      expect(result.current.loads[key]).toMatchObject({ more: 'loading' });
      await waitFor(() => expect(result.current.editionsOf(key)).toHaveLength(130));
      // The first page keeps its order; the second follows it.
      expect(result.current.editionsOf(key).slice(0, 100).map((e) => e.sourceId)).toEqual(first);
      expect(result.current.hasMore(key)).toBe(false);
      expect(result.current.loads[key]).toMatchObject({ total: 130, loaded: 130, more: 'idle' });
      // Nothing more to ask for.
      act(() => result.current.loadMore(key));
      expect(metadata.fixtures.calls.filter((u) => u.includes('/editions.json'))).toHaveLength(2);
    });

    it('finds an edition by ISBN, year or publisher among those loaded', async () => {
      const { result, key } = await newSpring();
      act(() => result.current.setFilters({ text: GRAPHIC_NOVEL }));
      expect(result.current.editionsOf(key)).toEqual([]);
      act(() => result.current.loadMore(key));
      await waitFor(() => expect(result.current.editionsOf(key).map((e) => e.isbn13)).toEqual([GRAPHIC_NOVEL]));
      act(() => result.current.setFilters({ text: '978-1-60690-208-0' }));
      expect(result.current.editionsOf(key).map((e) => e.isbn13)).toEqual([GRAPHIC_NOVEL]);
      act(() => result.current.setFilters({ text: 'dynamite' }));
      expect(result.current.editionsOf(key).map((e) => e.isbn13)).toEqual([GRAPHIC_NOVEL]);
      act(() => result.current.setFilters({ text: '2011' }));
      expect(result.current.editionsOf(key).every((e) => e.publicationYear === 2011)).toBe(true);
      act(() => result.current.setFilters({ text: 'dynamite 2011' }));
      expect(result.current.editionsOf(key).map((e) => e.isbn13)).toEqual([GRAPHIC_NOVEL]);
      act(() => result.current.setFilters({ text: '' }));
      expect(result.current.editionsOf(key)).toHaveLength(130);
    });

    it('a page that fails to load can be asked for again', async () => {
      const { result, key } = await newSpring();
      const spy = jest.spyOn(metadata.service, 'editionsPage').mockRejectedValueOnce(new Error('down'));
      act(() => result.current.loadMore(key));
      await waitFor(() => expect(result.current.loads[key]).toMatchObject({ more: 'error' }));
      expect(result.current.editionsOf(key)).toHaveLength(100);
      spy.mockRestore();
      act(() => result.current.loadMore(key));
      await waitFor(() => expect(result.current.editionsOf(key)).toHaveLength(130));
    });
  });

  it('a lone work opens straight away', async () => {
    const work = makeCandidate({ kind: 'work', title: 'The Colour of Magic', authors: ['Terry Pratchett'], workKey: 'OL453657W', source: 'openlibrary', sourceId: 'OL453657W' });
    const { result } = render(createSession({ source: 'cover', candidates: [work] }));
    expect(result.current.expanded.has(result.current.groups[0].key)).toBe(true);
    await waitFor(() => expect(result.current.loads[result.current.groups[0].key].status).toBe('ready'));
  });
});

describe('groupByWork / enrichEdition', () => {
  it('puts a Google Books volume with the Open Library work of the same title and author', () => {
    const work = makeCandidate({ kind: 'work', title: 'Mort', authors: ['Terry Pratchett'], workKey: 'OL1W', source: 'openlibrary', sourceId: 'OL1W', subjects: ['Fantasy'] });
    const volume = makeCandidate({ title: 'MORT', authors: ['Terry Pratchett'], isbn13: '9780552131063', source: 'googlebooks', sourceId: 'g1' });
    const other = makeCandidate({ title: 'Dune', authors: ['Frank Herbert'], source: 'googlebooks', sourceId: 'g2' });
    const groups = groupByWork([volume, work, other]);
    expect(groups).toHaveLength(2);
    expect(groups[0].work).toBe(work);
    expect(groups[0].members).toEqual([volume]);
    expect(enrichEdition(volume, groups[0])).toMatchObject({ subjects: ['Fantasy'], workKey: 'OL1W' });
  });
});
