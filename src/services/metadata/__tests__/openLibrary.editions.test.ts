/**
 * @jest-environment node
 */
import { createHttpClient, createRateLimiter } from '@/services/http';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { openLibraryRoutes } from '../__fixtures__/openLibraryRoutes';
import { createOpenLibrary } from '../openLibrary';

function setup() {
  const fixtures = createFixtureFetch(openLibraryRoutes);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
  return { ol: createOpenLibrary({ http }), fixtures };
}

describe('openLibrary.editions', () => {
  it("lists a work's editions with ISBNs, publishers, years and formats", async () => {
    const { ol, fixtures } = setup();
    const editions = await ol.editions('/works/OL453657W', { authors: ['Terry Pratchett'] });
    expect(fixtures.calls).toEqual(['https://openlibrary.org/works/OL453657W/editions.json?limit=100']);
    expect(editions).toHaveLength(13);
    const rows = editions.map((e) => [e.isbn13, e.publisher, e.publicationYear, e.format, e.language]);
    expect(rows).toEqual([
      ['9782266071567', 'Presses Pocket', 1999, null, 'fr'],
      ['9780063373662', 'HarperCollins Publishers', 2024, null, 'en'],
      ['9780312150846', "St. Martin's Press", 1983, null, 'en'], // isbn_10 only: ISBN-13 derived
      ['9780061020711', 'HarperPaperbacks', 2000, 'paperback', 'en'], // "Mass Market Paperback"
      ['9780061020711', 'HarperPaperbacks', 2000, null, 'en'],
      ['9783898975292', 'Bild', 1983, 'hardcover', 'de'], // "gebundene Ausgabe"
      ['9783837120691', 'Random House Audio', 2013, 'audiobook', null], // "audio cd", "Oct 08, 2013"
      ['9788587193391', 'Conrad', 2004, 'paperback', 'pt'], // "Brochura"
      [null, 'Psygnosis', 1995, 'other', 'en'], // a computer game catalogued as an edition, no ISBN
      ['9780061020711', 'HarperTorch', 2000, null, 'en'],
      ['9780061367458', 'HarperCollins', 2007, 'ebook', 'en'], // "Electronic resource"
      ['9780552124751', 'Corgi', 1990, 'paperback', 'en'],
      ['9780753107089', 'ISIS Audio Books', 2006, 'audiobook', 'en'], // "January 2006"
    ]);
    for (const e of editions) {
      expect(e).toMatchObject({ kind: 'edition', authors: ['Terry Pratchett'], workKey: 'OL453657W', source: 'openlibrary' });
      expect(e.sourceId).toMatch(/^OL\d+M$/);
    }
    // Series strings on editions become hints.
    expect(editions[3].seriesHints).toEqual([{ name: 'Discworld', position: 1, source: 'openlibrary', raw: 'Discworld (1)' }]);
    expect(editions[7].seriesHints).toEqual([{ name: 'Discworld', position: 1, source: 'openlibrary', raw: 'Discworld Vol. 1' }]);
    expect(editions[11].seriesHints).toEqual([{ name: 'Discworld', position: 1, source: 'openlibrary', raw: 'Discworld #1' }]);
  });

  it('returns [] for an unknown work', async () => {
    const { ol } = setup();
    // No fixture: the fetch answers 501, which is not a 404 — so check a 404 explicitly.
    const fixtures = createFixtureFetch({ 'https://openlibrary.org/works/OL1W/editions.json?limit=100': { status: 404, text: '' } });
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    await expect(createOpenLibrary({ http }).editions('OL1W')).resolves.toEqual([]);
    await expect(ol.editions('')).resolves.toEqual([]);
  });

  it('pages through a work with more editions than one page, 100 at a time', async () => {
    const { ol, fixtures } = setup();
    const first = await ol.editionsPage('OL99999W', { authors: ['Robert Jordan'] });
    expect(first.editions).toHaveLength(100);
    expect(first.total).toBe(130);
    expect(first.nextOffset).toBe(100);
    const second = await ol.editionsPage('OL99999W', { authors: ['Robert Jordan'], offset: first.nextOffset! });
    expect(second.editions).toHaveLength(30);
    expect(second.total).toBe(130);
    expect(second.nextOffset).toBeNull();
    expect(second.editions.find((e) => e.subtitle === 'The Graphic Novel')?.isbn13).toBe('9781606902080');
    expect(fixtures.calls).toEqual([
      'https://openlibrary.org/works/OL99999W/editions.json?limit=100',
      'https://openlibrary.org/works/OL99999W/editions.json?limit=100&offset=100',
    ]);
    // The first page is what `editions` returns.
    expect((await ol.editions('OL99999W')).map((e) => e.sourceId)).toEqual(first.editions.map((e) => e.sourceId));
  });

  it('has no next page when the work has one page, or a page comes back empty', async () => {
    const { ol } = setup();
    expect(await ol.editionsPage('OL1W').catch(() => null)).toBeNull();
    const fixtures = createFixtureFetch({
      'https://openlibrary.org/works/OL2W/editions.json?limit=100': { body: { size: 2, entries: [{ key: '/books/OL1M', title: 'A' }, { key: '/books/OL2M', title: 'B' }] } },
      'https://openlibrary.org/works/OL3W/editions.json?limit=100&offset=100': { body: { size: 500, entries: [] } },
    });
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const other = createOpenLibrary({ http });
    await expect(other.editionsPage('OL2W')).resolves.toMatchObject({ total: 2, nextOffset: null });
    await expect(other.editionsPage('OL3W', { offset: 100 })).resolves.toMatchObject({ editions: [], nextOffset: null });
  });
});
