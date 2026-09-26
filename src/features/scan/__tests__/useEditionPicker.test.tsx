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

  it('a work whose editions fail to load can be chosen itself', async () => {
    jest.spyOn(metadata.service, 'editions').mockRejectedValue(new Error('down'));
    const { result } = render(await coverSession());
    const group = result.current.groups.find((g) => g.members.length === 0)!;
    act(() => result.current.toggle(group.key));
    await waitFor(() => expect(result.current.loads[group.key].status).toBe('error'));
    expect(result.current.editionsOf(group.key)).toEqual([group.work]);
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
