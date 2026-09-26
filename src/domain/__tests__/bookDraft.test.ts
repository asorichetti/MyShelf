import {
  draftFromDetail,
  draftsDiffer,
  emptyDraft,
  firstInvalidField,
  languageName,
  languages,
  validateBookDraft,
  type BookDetail,
  type BookDraft,
} from '@/domain';

const draft = (patch: Partial<BookDraft> = {}): BookDraft => ({ ...emptyDraft(), title: 'Dune', ...patch });
const validate = (patch: Partial<BookDraft> = {}) => validateBookDraft(draft(patch), { currentYear: 2026 });
const errorOf = (patch: Partial<BookDraft>, field: keyof BookDraft) => {
  const r = validate(patch);
  return r.ok ? undefined : r.errors[field];
};
const valueOf = (patch: Partial<BookDraft>) => {
  const r = validate(patch);
  if (!r.ok) throw new Error(`expected valid, got ${JSON.stringify(r.errors)}`);
  return r.value;
};

describe('title', () => {
  it('is required', () => {
    expect(errorOf({ title: '   ' }, 'title')).toBe('Every book needs a title.');
    expect(valueOf({ title: '  Dune  ' }).title).toBe('Dune');
  });

  it('is at most 300 characters', () => {
    expect(valueOf({ title: 'x'.repeat(300) }).title).toHaveLength(300);
    expect(errorOf({ title: 'x'.repeat(301) }, 'title')).toMatch(/under 300 characters/);
  });
});

describe('ISBN', () => {
  it('is optional', () => {
    expect(valueOf({ isbn: '' })).toMatchObject({ isbn13: null, isbn10: null });
  });

  it('accepts hyphens and spaces and stores both forms', () => {
    expect(valueOf({ isbn: '978-0-441-17271-9' })).toMatchObject({ isbn13: '9780441172719', isbn10: '0441172717' });
    expect(valueOf({ isbn: '0 441 17271 7' })).toMatchObject({ isbn13: '9780441172719', isbn10: '0441172717' });
  });

  it('converts an ISBN-10 with an X check digit to ISBN-13', () => {
    expect(valueOf({ isbn: '057504800x' })).toMatchObject({ isbn13: '9780575048003', isbn10: '057504800X' });
  });

  it('keeps a 979 ISBN-13, which has no ISBN-10', () => {
    expect(valueOf({ isbn: '9791032305690' })).toMatchObject({ isbn13: '9791032305690', isbn10: null });
  });

  it('explains a bad check digit in plain language', () => {
    expect(errorOf({ isbn: '9780000000000' }, 'isbn')).toBe('That ISBN doesn’t look right — check the last digit.');
    expect(errorOf({ isbn: '0441172718' }, 'isbn')).toBe('That ISBN doesn’t look right — check the last digit.');
  });

  it('explains a wrong length or stray characters', () => {
    expect(errorOf({ isbn: '12345' }, 'isbn')).toBe('An ISBN has 10 or 13 digits — this one has 5.');
    expect(errorOf({ isbn: 'ISBN 978' }, 'isbn')).toMatch(/only has digits/);
  });
});

describe('year', () => {
  it('accepts 1450 to next year', () => {
    expect(valueOf({ year: '1450' }).publicationYear).toBe(1450);
    expect(valueOf({ year: '2027' }).publicationYear).toBe(2027);
    expect(valueOf({ year: '' }).publicationYear).toBeNull();
  });

  it('rejects years out of range or not a year', () => {
    expect(errorOf({ year: '1449' }, 'year')).toBe('Enter a year between 1450 and 2027.');
    expect(errorOf({ year: '2028' }, 'year')).toBe('Enter a year between 1450 and 2027.');
    expect(errorOf({ year: '19xx' }, 'year')).toBe('Enter the year as four digits, like 1987.');
    expect(errorOf({ year: '1987.5' }, 'year')).toMatch(/four digits/);
  });
});

describe('page count', () => {
  it('is a positive whole number', () => {
    expect(valueOf({ pages: ' 320 ' }).pageCount).toBe(320);
    expect(errorOf({ pages: '0' }, 'pages')).toBe('Pages should be a whole number, like 320.');
    expect(errorOf({ pages: '-4' }, 'pages')).toMatch(/whole number/);
    expect(errorOf({ pages: '12.5' }, 'pages')).toMatch(/whole number/);
    expect(errorOf({ pages: '1000000' }, 'pages')).toMatch(/lot of pages/);
  });
});

describe('language and format', () => {
  it('come from their lists', () => {
    expect(valueOf({ language: 'fr', format: 'hardcover' })).toMatchObject({ language: 'fr', format: 'hardcover' });
    expect(valueOf({ language: '', format: '' })).toMatchObject({ language: null, format: null });
    expect(errorOf({ language: 'English' }, 'language')).toBe('Pick a language from the list.');
    expect(errorOf({ format: 'scroll' as never }, 'format')).toBe('Pick a format from the list.');
  });

  it('names languages, including codes a lookup may bring', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName('zz')).toBe('zz');
    expect(languageName('mi')).toBe('Māori');
    expect(new Set(languages.map((l) => l.code)).size).toBe(languages.length);
  });
});

describe('series', () => {
  it('takes a position of 0 or more with at most one decimal', () => {
    expect(valueOf({ seriesName: 'Discworld', seriesPosition: '5' }).series).toEqual({ name: 'Discworld', position: 5 });
    expect(valueOf({ seriesName: 'Discworld', seriesPosition: '2.5' }).series).toEqual({ name: 'Discworld', position: 2.5 });
    expect(valueOf({ seriesName: 'Discworld', seriesPosition: '0' }).series).toEqual({ name: 'Discworld', position: 0 });
    expect(valueOf({ seriesName: 'Discworld' }).series).toEqual({ name: 'Discworld', position: null });
    expect(errorOf({ seriesName: 'Discworld', seriesPosition: '2.25' }, 'seriesPosition')).toMatch(/like 3, or 2.5/);
    expect(errorOf({ seriesName: 'Discworld', seriesPosition: '-1' }, 'seriesPosition')).toMatch(/like 3/);
  });

  it('needs a name when a position is given', () => {
    expect(errorOf({ seriesPosition: '3' }, 'seriesName')).toBe('Add the series name to go with its number.');
    expect(valueOf({ seriesName: '  ' }).series).toBeNull();
  });
});

describe('authors and genres', () => {
  it('trims, drops blanks and de-duplicates case-insensitively, keeping order', () => {
    const v = valueOf({
      authors: [
        { name: ' Terry  Pratchett ', role: 'author', sortName: null },
        { name: '', role: 'author', sortName: null },
        { name: 'terry pratchett', role: 'editor', sortName: null },
        { name: 'Neil Gaiman', role: 'author', sortName: '  ' },
      ],
      genres: ['Fantasy', ' fantasy ', '', 'Humour'],
    });
    expect(v.authors).toEqual([
      { name: 'Terry Pratchett', role: 'author', sortName: null },
      { name: 'Neil Gaiman', role: 'author', sortName: null },
    ]);
    expect(v.genres).toEqual(['Fantasy', 'Humour']);
  });
});

describe('cleaning and helpers', () => {
  it('turns empty text into null', () => {
    expect(valueOf({ subtitle: ' ', publisher: '', summary: '  A story. ', notes: '' })).toMatchObject({
      subtitle: null,
      publisher: null,
      summary: 'A story.',
      notes: null,
    });
  });

  it('reports every failing field and finds the first in form order', () => {
    const r = validate({ title: '', isbn: '123', pages: 'x' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['isbn', 'pages', 'title']);
    expect(firstInvalidField(r.errors)).toBe('title');
    expect(firstInvalidField({ pages: 'x', isbn: 'y' })).toBe('isbn');
    expect(firstInvalidField({})).toBeNull();
  });

  it('round-trips a saved book into form values', () => {
    const detail = {
      id: 1,
      title: 'Mort',
      subtitle: null,
      isbn13: '9780552131063',
      isbn10: '0552131067',
      edition: null,
      publisher: 'Corgi',
      publicationYear: 1987,
      pageCount: 272,
      summary: null,
      coverUri: null,
      language: 'en',
      format: 'paperback',
      seriesId: 3,
      seriesPosition: 4,
      source: 'manual',
      sourceId: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
      authors: [{ id: 1, name: 'Terry Pratchett', sortName: 'Pratchett, Terry', role: 'author', position: 0 }],
      genres: [{ id: 1, name: 'Fantasy', userEdited: true }],
      series: { id: 3, name: 'Discworld', totalCount: null },
      openLoan: null,
    } satisfies BookDetail;
    const d = draftFromDetail(detail);
    expect(d).toMatchObject({ isbn: '9780552131063', year: '1987', pages: '272', seriesName: 'Discworld', seriesPosition: '4', genres: ['Fantasy'] });
    expect(draftsDiffer(d, draftFromDetail(detail))).toBe(false);
    expect(draftsDiffer(d, { ...d, year: '1988' })).toBe(true);
    expect(validateBookDraft(d, { currentYear: 2026 }).ok).toBe(true);
  });
});
