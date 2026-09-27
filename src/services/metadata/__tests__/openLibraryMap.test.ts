import { toIso6391 } from '@/domain/languages';

import { olFixtures } from '../__fixtures__/openLibraryRoutes';
import {
  authorDisplayName,
  authorKeys,
  cleanText,
  coverUrlFromId,
  descriptionText,
  mapEdition,
  mapPageCount,
  mapPhysicalFormat,
  mapSearchDoc,
  mapSeriesHints,
  olid,
  parsePublishYear,
  uniqueStrings,
  wantsLatinNames,
} from '../openLibraryMap';

describe('parsePublishYear', () => {
  it.each<[string | undefined, number | null]>([
    ['1985', 1985],
    ['March 2007', 2007],
    ['Jul 12, 2019', 2019],
    ['1983-01-01', 1983],
    ['January 1, 1983', 1983],
    ['c1965', 1965],
    ['[2003?]', 2003],
    ['May 01, 1985', 1985],
    ['12345', null],
    ['1420', null], // before printing: a misread, and the book form would refuse it
    ['2999', null], // a placeholder, far in the future
    ['n.d.', null],
    ['', null],
    [undefined, null],
  ])('%p → %p', (text, year) => {
    expect(parsePublishYear(text)).toBe(year);
  });
});

describe('mapPhysicalFormat', () => {
  // Every physical_format in the recorded fixtures, plus common variants.
  it.each<[string | undefined, string | null]>([
    ['Paperback', 'paperback'],
    ['paperback', 'paperback'],
    ['Mass Market Paperback', 'paperback'],
    ['mass market paperback', 'paperback'],
    ['Brochura', 'paperback'],
    ['Taschenbuch', 'paperback'],
    ['Hardcover', 'hardcover'],
    ['hardcover', 'hardcover'],
    ['gebundene Ausgabe', 'hardcover'],
    ['Library Binding', 'hardcover'],
    ['Board book', 'hardcover'],
    ['Audio CD', 'audiobook'],
    ['audio cd', 'audiobook'],
    ['Audio cassette', 'audiobook'],
    ['MP3 CD', 'audiobook'],
    ['Electronic resource', 'ebook'],
    ['Kindle Edition', 'ebook'],
    ['ebook', 'ebook'],
    ['Computer file', 'other'],
    ['Map', 'other'],
    ['', null],
    [undefined, null],
  ])('%p → %p', (text, format) => {
    expect(mapPhysicalFormat(text)).toBe(format);
  });
});

describe('descriptionText', () => {
  it('reads a plain string or a {type, value} object', () => {
    expect(descriptionText('A story.')).toBe('A story.');
    expect(descriptionText({ type: '/type/text', value: 'A story.' })).toBe('A story.');
    expect(descriptionText({ type: '/type/text' })).toBeNull();
    expect(descriptionText(undefined)).toBeNull();
    expect(descriptionText('   ')).toBeNull();
  });

  it('removes Markdown emphasis and links and the "see also" block', () => {
    const raw =
      '*Le Petit Prince* est une œuvre de langue **française**.\r\n\r\nVoir [Wikipedia](https://fr.wikipedia.org/wiki/x).\r\n\r\n----------\r\nAlso contained in:\r\n- [Œuvres](https://openlibrary.org/works/OL1W)';
    expect(descriptionText(raw)).toBe('Le Petit Prince est une œuvre de langue française.\n\nVoir Wikipedia.');
  });

  it('drops back-cover markers', () => {
    expect(descriptionText({ value: '[back cover] \r\nHarry Potter thinks he is an ordinary boy.' })).toBe(
      'Harry Potter thinks he is an ordinary boy.',
    );
    expect(descriptionText('A comedy of manners.\r\n--back cover')).toBe('A comedy of manners.');
  });

  it('keeps underscores inside words', () => {
    expect(descriptionText('see snake_case_name here')).toBe('see snake_case_name here');
  });
});

describe('small helpers', () => {
  it.each([
    ['/books/OL28477029M', 'OL28477029M'],
    ['/works/OL453657W', 'OL453657W'],
    ['OL453657W', 'OL453657W'],
    ['', null],
    [undefined, null],
  ])('olid(%p) → %p', (key, id) => {
    expect(olid(key)).toBe(id);
  });

  it('builds cover URLs and ignores the -1 "no cover" id', () => {
    expect(coverUrlFromId(14647238)).toBe('https://covers.openlibrary.org/b/id/14647238-L.jpg');
    expect(coverUrlFromId(14647238, 'M')).toBe('https://covers.openlibrary.org/b/id/14647238-M.jpg');
    expect(coverUrlFromId(-1)).toBeNull();
    expect(coverUrlFromId(undefined)).toBeNull();
  });

  it.each<[{ number_of_pages?: number; pagination?: string }, number | null]>([
    [{ number_of_pages: 287 }, 287],
    [{ pagination: 'xlii, 435 p.' }, 435],
    [{ pagination: '535 p. :' }, 535],
    [{ pagination: '495p. ;' }, 495],
    [{ number_of_pages: 0, pagination: '12 p.' }, 12],
    [{ number_of_pages: 9780552166591 }, null], // an ISBN typed into the pages field
    [{ pagination: 'ISBN 9780552166591' }, null],
    [{}, null],
  ])('page count from %p → %p', (edition, pages) => {
    expect(mapPageCount(edition)).toBe(pages);
  });

  it.each<[string | undefined, string | null]>([
    ['/languages/eng', 'en'],
    ['/languages/fre', 'fr'],
    ['/languages/spa', 'es'],
    ['/languages/ger', 'de'],
    ['/languages/pol', 'pl'],
    ['/languages/cze', 'cs'],
    ['/languages/yid', 'yi'],
    ['eng', 'en'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['/languages/mul', null],
    ['/languages/und', null],
    ['/languages/xyz', null],
    [undefined, null],
  ])('language %p → %p', (key, code) => {
    expect(toIso6391(key)).toBe(code);
  });

  it('de-duplicates strings case-insensitively, keeping the first spelling', () => {
    expect(uniqueStrings(['Fiction', 'fiction', ' Fantasy ', '', null, 'FANTASY'])).toEqual(['Fiction', 'Fantasy']);
  });

  it('parses series strings into hints and drops imprints', () => {
    expect(mapSeriesHints(['Discworld, Book 1', 'Penguin Classics'])).toEqual([
      { name: 'Discworld', position: 1, source: 'openlibrary', raw: 'Discworld, Book 1' },
    ]);
    expect(mapSeriesHints(undefined)).toEqual([]);
  });

  it('takes author keys from the edition, else from the work', () => {
    const { editions, works } = olFixtures;
    expect(authorKeys(editions.colourOfMagic, works.colourOfMagic)).toEqual(['OL25712A']);
    expect(authorKeys(editions.theMartian, works.theMartian)).toEqual(['OL7234434A']);
    expect(authorKeys(editions.noDescription, works.noDescription)).toEqual([]);
  });
});

describe('mapEdition with recorded fixtures', () => {
  const { editions, works } = olFixtures;

  it('maps a paperback in a numbered series (The Colour of Magic, Corgi)', () => {
    const c = mapEdition(editions.colourOfMagic, {
      work: works.colourOfMagic,
      authors: ['Terry Pratchett'],
      requestedIsbn13: '9780552166591',
      confidence: 0.95,
    });
    expect(c).toMatchObject({
      kind: 'edition',
      title: 'The Colour of Magic',
      subtitle: null,
      authors: ['Terry Pratchett'],
      publisher: 'Corgi Books',
      publicationYear: 1985,
      pageCount: 287,
      isbn13: '9780552166591',
      isbn10: '0552166596',
      language: 'en',
      format: 'paperback',
      coverUrl: 'https://covers.openlibrary.org/b/id/14647238-L.jpg',
      seriesHints: [{ name: 'Discworld', position: 1, source: 'openlibrary', raw: 'Discworld, Book 1' }],
      workKey: 'OL453657W',
      source: 'openlibrary',
      sourceId: 'OL28477029M',
      confidence: 0.95,
    });
    expect(c.summary).toMatch(/^Terry Pratchett's profoundly irreverent novels/);
    // Edition subjects first, then the work's, without duplicates.
    expect(c.subjects.slice(0, 3)).toEqual([
      'Discworld (imaginary place), fiction',
      'Fiction, fantasy, general',
      'Fiction, humorous',
    ]);
    expect(c.subjects).toContain('Fantasy');
  });

  it('maps a modern hardback (Harry Potter, Bloomsbury 1997)', () => {
    const c = mapEdition(editions.philosophersStone, { work: works.philosophersStone, authors: ['J. K. Rowling'] });
    expect(c).toMatchObject({
      title: "Harry Potter and the Philosopher's Stone",
      publisher: 'Bloomsbury Publishing',
      publicationYear: 1997,
      pageCount: 223,
      isbn13: '9780747532699',
      isbn10: '0747532699',
      format: 'hardcover',
      coverUrl: 'https://covers.openlibrary.org/b/id/7355968-L.jpg',
      seriesHints: [{ name: 'Harry Potter', position: 1 }],
    });
    // The work description wins over the edition's back-cover text.
    expect(c.summary).toMatch(/^Turning the envelope over/);
  });

  it('maps an old paperback with only an ISBN-10 (Fellowship, Ballantine)', () => {
    const c = mapEdition(editions.fellowship, { work: works.fellowship, authors: ['J.R.R. Tolkien'] });
    expect(c).toMatchObject({
      isbn13: '9780345339706',
      isbn10: '0345339703',
      edition: '97. edition',
      publicationYear: 2001,
      format: 'paperback',
    });
  });

  it('picks the ISBN-10 that matches the requested ISBN when an edition lists two (Dune, Ace)', () => {
    const c = mapEdition(editions.dune, { work: works.dune, requestedIsbn13: '9780441172719' });
    expect(c).toMatchObject({ isbn13: '9780441172719', isbn10: '0441172717', pageCount: 535, format: null });
    expect(c.seriesHints).toEqual([{ name: 'Dune chronicles', position: 1, source: 'openlibrary', raw: 'Dune chronicles -- bk. 1' }]);
  });

  it('maps non-English editions with ISO 639-1 languages', () => {
    const fr = mapEdition(editions.petitPrince, { work: works.petitPrince });
    expect(fr).toMatchObject({ title: 'Le Petit Prince', language: 'fr', publicationYear: 2007, publisher: 'Editions Gallimard' });
    expect(fr.summary).toMatch(/^Le Petit Prince est une œuvre/);
    const es = mapEdition(editions.cienAnos, { work: works.cienAnos });
    expect(es).toMatchObject({ language: 'es', isbn13: '9788497592208', isbn10: '8497592204', pageCount: 495, format: null });
    // No edition cover: falls back to the work's.
    expect(es.coverUrl).toBe('https://covers.openlibrary.org/b/id/12627383-L.jpg');
  });

  it('maps an edition whose work has no description, authors or subjects', () => {
    const c = mapEdition(editions.noDescription, { work: works.noDescription });
    expect(c).toMatchObject({
      title: 'Kitab Jurumiyyah',
      authors: [],
      summary: null,
      subjects: [],
      coverUrl: null,
      language: null,
      pageCount: null,
      publicationYear: 2023,
    });
  });

  it('uses the edition description when there is no work', () => {
    const c = mapEdition(editions.theMartian);
    expect(c.summary).toMatch(/^Six days ago, astronaut Mark Watney/);
    expect(c.summary).not.toMatch(/back cover/);
    expect(c.workKey).toBe('OL17091839W');
  });

  it('tolerates an empty object', () => {
    expect(mapEdition({})).toMatchObject({ title: 'Untitled', authors: [], isbn13: null, sourceId: 'unknown' });
  });
});

describe('cleanText', () => {
  it('composes decomposed accents, as in the recorded "Cien años" record', () => {
    const raw = olFixtures.editions.cienAnos.title;
    expect(raw).not.toBe('Cien años de soledad');
    expect(cleanText(raw)).toBe('Cien años de soledad');
    expect(cleanText('  a \n b ')).toBe('a b');
    expect(cleanText('   ')).toBeNull();
  });
});

describe('mapSearchDoc', () => {
  it('maps a search document to a work candidate', () => {
    const doc = olFixtures.searchColourOfMagic.docs[0];
    expect(mapSearchDoc(doc)).toMatchObject({
      kind: 'work',
      title: 'The Colour of Magic',
      authors: ['Terry Pratchett'],
      publicationYear: 1983,
      isbn13: null,
      workKey: 'OL453657W',
      sourceId: 'OL453657W',
      editionCount: 93,
      coverUrl: expect.stringMatching(/^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-L\.jpg$/),
    });
  });

  it('skips documents without a key or title', () => {
    expect(mapSearchDoc({ title: 'x' })).toBeNull();
    expect(mapSearchDoc({ key: '/works/OL1W' })).toBeNull();
  });

  it('sets the language only when the work has exactly one', () => {
    expect(mapSearchDoc({ key: '/works/OL1W', title: 'x', language: ['fre'] })?.language).toBe('fr');
    expect(mapSearchDoc({ key: '/works/OL1W', title: 'x', language: ['eng', 'fre'] })?.language).toBeNull();
  });

  it('keeps every language of the work for ranking, as ISO 639-1 codes', () => {
    expect(mapSearchDoc({ key: '/works/OL1W', title: 'x', language: ['eng', 'dut', 'eng'] })?.languages).toEqual(['en', 'nl']);
    expect(mapSearchDoc({ key: '/works/OL1W', title: 'x' })?.languages).toEqual([]);
  });
});

describe('authorDisplayName', () => {
  // OL382524A, September 2026: the name is stored in Japanese.
  const murakami = {
    name: '村上春樹',
    personal_name: 'Murakami, Haruki',
    alternate_names: ['春樹 村上', 'HARUKI MURAKAMI', 'Haruki MURAKAMI', 'MURAKAMI HARUKI', 'Murakami Haruki', 'Haruki Murakami', 'Харуки Мураками'],
  };

  it('credits a non-Latin name in Latin letters for a Latin-script edition', () => {
    expect(authorDisplayName(murakami)).toBe('Haruki Murakami');
    expect(authorDisplayName({ name: '村上春樹', alternate_names: ['HARUKI MURAKAMI', 'Haruki MURAKAMI', 'Haruki Murakami'] })).toBe('Haruki Murakami');
    expect(authorDisplayName({ name: '村上春樹', alternate_names: ['MURAKAMI HARUKI'] })).toBe('MURAKAMI HARUKI');
  });

  it('keeps the name as stored for an edition in its own script, or when it is already in Latin letters', () => {
    expect(authorDisplayName(murakami, { latinScript: false })).toBe('村上春樹');
    expect(authorDisplayName({ name: 'Gabriel García Márquez', alternate_names: ['Габриэль Гарсиа Маркес'] })).toBe('Gabriel García Márquez');
    expect(authorDisplayName({ name: 'Лев Толстой' })).toBe('Лев Толстой');
    expect(authorDisplayName(null)).toBeNull();
  });

  it('knows which languages are written in other scripts', () => {
    expect(wantsLatinNames('en')).toBe(true);
    expect(wantsLatinNames(null)).toBe(true);
    expect(wantsLatinNames('ja')).toBe(false);
    expect(wantsLatinNames('ru')).toBe(false);
  });
});
