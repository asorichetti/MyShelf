/**
 * Google Books fixtures, keyed by the URL the provider requests.
 *
 * `quota-exceeded-429.json` is a real response, recorded in September 2026:
 * keyless requests were refused with a daily-quota 429 (quota limit 0 on
 * Google's shared keyless project) from two networks, so no successful
 * response could be recorded. The `synthetic-*` files are hand-written to
 * the documented v1 Volume schema (`fields=` filtered, as the provider asks)
 * with facts from the matching Open Library records; their volume ids are
 * invented (`synth…`). Re-record them when keyless access works again.
 */
import { withQuery } from '@/services/http/url';
import type { FixtureRoutes } from '@/testing/fixtureFetch';

import quotaExceeded from './googlebooks/quota-exceeded-429.json';
import empty from './googlebooks/synthetic-empty.json';
import prideAndPrejudice from './googlebooks/synthetic-isbn-9780141439518.json';
import colourOfMagic from './googlebooks/synthetic-isbn-9780552166591.json';
import theMartian from './googlebooks/synthetic-isbn-9780553418026.json';
import petitPrince from './googlebooks/synthetic-isbn-9782070612758.json';
import noItems from './googlebooks/synthetic-no-items.json';
import searchColourOfMagic from './googlebooks/synthetic-search-colour-of-magic.json';

const GB = 'https://www.googleapis.com/books/v1/volumes';
const FIELDS =
  'totalItems,items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks,language,seriesInfo))';

export const gbIsbnUrl = (isbn: string) => withQuery(GB, { q: `isbn:${isbn}`, maxResults: 5, printType: 'books', fields: FIELDS });
export const gbSearchUrl = (q: string) => withQuery(GB, { q, maxResults: 10, printType: 'books', fields: FIELDS });

export const googleBooksRoutes: FixtureRoutes = {
  [gbIsbnUrl('9780552166591')]: { body: colourOfMagic },
  [gbIsbnUrl('9780553418026')]: { body: theMartian },
  [gbIsbnUrl('9782070612758')]: { body: petitPrince },
  [gbIsbnUrl('9780141439518')]: { body: prideAndPrejudice },
  // No Google Books match for these recorded Open Library books.
  [gbIsbnUrl('9788497592208')]: { body: empty },
  [gbIsbnUrl('9780000000002')]: { body: empty },
  [gbIsbnUrl('9791099999993')]: { body: empty },
  [gbIsbnUrl('9780345339706')]: { body: noItems },
  [gbIsbnUrl('9780140306941')]: { body: empty },
  [gbSearchUrl('intitle:"the colour of magic" inauthor:"pratchett"')]: { body: searchColourOfMagic },
  // The same synthetic volumes for the free-text searches the lookup field and typed cover text send.
  [gbSearchUrl('colour of magic pratchett')]: { body: searchColourOfMagic },
  [gbSearchUrl('the colour of magic terry pratchett')]: { body: searchColourOfMagic },
};

/** The real keyless response: a daily-quota 429. */
export const gbQuotaExceeded = { status: 429, body: quotaExceeded };

export const gbFixtures = { colourOfMagic, theMartian, petitPrince, prideAndPrejudice, empty, searchColourOfMagic, quotaExceeded };
