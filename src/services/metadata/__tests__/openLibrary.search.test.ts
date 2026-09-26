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

describe('openLibrary.search', () => {
  it('searches by title and author and returns the work first', async () => {
    const { ol, fixtures } = setup();
    const results = await ol.search({ title: 'the colour of magic', author: 'pratchett' });
    expect(fixtures.calls).toEqual([
      'https://openlibrary.org/search.json?title=the%20colour%20of%20magic&author=pratchett' +
        '&fields=key%2Ctitle%2Cauthor_name%2Cfirst_publish_year%2Cedition_count%2Cisbn%2Ccover_i%2Csubject%2Clanguage&limit=10',
    ]);
    expect(fixtures.unmocked).toEqual([]);
    expect(results.map((r) => r.title)).toEqual([
      'The Colour of Magic',
      'The Colour of Magic / The Light Fantastic',
      "Terry Pratchett's The colour of magic",
      'The Colour of Magic, The Light Fantastic, Equal Rites',
    ]);
    expect(results[0]).toMatchObject({
      kind: 'work',
      workKey: 'OL453657W',
      authors: ['Terry Pratchett'],
      publicationYear: 1983,
      editionCount: 93,
      isbn13: null,
      source: 'openlibrary',
    });
    expect(results[0].subjects).toContain('Fantasy');
  });

  it('searches free text with q=', async () => {
    const { ol, fixtures } = setup();
    const results = await ol.search({ text: 'dune frank herbert' });
    expect(fixtures.calls[0]).toContain('/search.json?q=dune%20frank%20herbert&fields=');
    expect(fixtures.unmocked).toEqual([]);
    expect(results[0]).toMatchObject({ title: 'Dune', authors: ['Frank Herbert'], workKey: 'OL893414W', editionCount: 155 });
    expect(results.map((r) => r.title)).toContain('Dune Messiah');
  });

  it('does not call the API for an empty query', async () => {
    const { ol, fixtures } = setup();
    await expect(ol.search({ title: '  ', text: '' })).resolves.toEqual([]);
    expect(fixtures.calls).toEqual([]);
  });
});
