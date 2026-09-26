import { APP_RATE_RULES, OL_COVERS_BY_ID, OL_COVERS_BY_ISBN, rateKeyOf } from '../etiquette';

describe('rateKeyOf', () => {
  it.each([
    ['https://openlibrary.org/isbn/9780552166591.json', 'openlibrary.org'],
    ['https://openlibrary.org/search.json?q=isbn:(1 OR 2)', 'openlibrary.org'],
    ['https://covers.openlibrary.org/b/id/14647238-L.jpg', OL_COVERS_BY_ID],
    ['https://covers.openlibrary.org/b/isbn/9780552166591-L.jpg?default=false', OL_COVERS_BY_ISBN],
    ['https://covers.openlibrary.org/b/olid/OL28477029M-L.jpg?default=false', 'covers.openlibrary.org'],
    ['https://Books.Google.com/books/content?id=x', 'books.google.com'],
    ['not a url', 'not a url'],
  ])('%s → %s', (url, key) => {
    expect(rateKeyOf(url)).toBe(key);
  });
});

describe('APP_RATE_RULES', () => {
  it('stays inside Open Library’s documented limits', () => {
    // Covers by id: not rate-limited, kept to the 3 requests/second of an identified client.
    expect(1000 / APP_RATE_RULES[OL_COVERS_BY_ID].minIntervalMs!).toBeLessThanOrEqual(3);
    expect(APP_RATE_RULES[OL_COVERS_BY_ID].maxConcurrent).toBeLessThanOrEqual(3);
    // Covers by ISBN: 100 per 5 minutes per IP.
    expect((5 * 60_000) / APP_RATE_RULES[OL_COVERS_BY_ISBN].minIntervalMs!).toBeLessThanOrEqual(100);
  });
});
