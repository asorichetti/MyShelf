/**
 * @jest-environment node
 */
import { makeCandidate } from '@/services/metadata';

import { combineCoverSources, coverSourceFromBook, coverSourceFromCandidate } from '../coverSource';
import { coverCandidates, googleCoverUrlForVolume, upgradeGoogleCoverUrl, type CoverSource } from '../coverUrls';

const OL = 'https://covers.openlibrary.org/b';
const G = 'https://books.google.com/books/content';

describe('coverCandidates: the chain, best first', () => {
  it.each<[string, CoverSource, string[]]>([
    [
      'everything known',
      {
        isbn13: '9780552166591',
        isbn10: '0552166596',
        olEditionCoverIds: [14647238],
        olWorkCoverIds: [13642933, 13946817],
        googleImageUrl: `http://books.google.com/books/content?id=7YBX8sWHq4sC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api`,
      },
      [
        `openlibrary-edition ${OL}/id/14647238-L.jpg`,
        `openlibrary-work ${OL}/id/13642933-L.jpg`,
        `openlibrary-isbn13 ${OL}/isbn/9780552166591-L.jpg?default=false`,
        `openlibrary-isbn10 ${OL}/isbn/0552166596-L.jpg?default=false`,
        `googlebooks ${G}?id=7YBX8sWHq4sC&printsec=frontcover&img=1&source=gbs_api&zoom=1&fife=w800`,
      ],
    ],
    [
      'ISBN-13 only: ISBN-10 derived',
      { isbn13: '978-0-7475-3269-9' },
      [`openlibrary-isbn13 ${OL}/isbn/9780747532699-L.jpg?default=false`, `openlibrary-isbn10 ${OL}/isbn/0747532699-L.jpg?default=false`],
    ],
    [
      'an old ISBN-10-only book: ISBN-13 derived',
      { isbn10: '0345339703' },
      [`openlibrary-isbn13 ${OL}/isbn/9780345339706-L.jpg?default=false`, `openlibrary-isbn10 ${OL}/isbn/0345339703-L.jpg?default=false`],
    ],
    ['a 979 ISBN has no ISBN-10', { isbn13: '9791099999993' }, [`openlibrary-isbn13 ${OL}/isbn/9791099999993-L.jpg?default=false`]],
    [
      'no edition cover: edition id, then the work',
      { olEditionCoverIds: [-1], olEditionId: 'OL18986719M', olWorkCoverIds: [12627383] },
      [`openlibrary-olid ${OL}/olid/OL18986719M-L.jpg?default=false`, `openlibrary-work ${OL}/id/12627383-L.jpg`],
    ],
    ['edition and work share a cover: tried once', { olEditionCoverIds: [7], olWorkCoverIds: [7] }, [`openlibrary-edition ${OL}/id/7-L.jpg`]],
    ['a Google volume id alone', { googleVolumeId: 'abc_12-X' }, [`googlebooks ${G}?id=abc_12-X&printsec=frontcover&img=1&zoom=1&fife=w800`]],
    ['invalid ISBNs are skipped', { isbn13: '9780552166592', isbn10: '123' }, []],
    ['nothing known', {}, []],
  ])('%s', (_name, source, expected) => {
    expect(coverCandidates(source).map((c) => `${c.origin} ${c.url}`)).toEqual(expected);
  });

  it('leaves Google out when the user turned it off', () => {
    const source = { isbn13: '9780552166591', googleVolumeId: 'x' };
    expect(coverCandidates(source, { includeGoogle: false }).map((c) => c.origin)).toEqual(['openlibrary-isbn13', 'openlibrary-isbn10']);
  });
});

describe('upgradeGoogleCoverUrl', () => {
  it.each([
    [
      'an API thumbnail',
      'http://books.google.com/books/content?id=7YBX8sWHq4sC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
      `${G}?id=7YBX8sWHq4sC&printsec=frontcover&img=1&source=gbs_api&zoom=1&fife=w800`,
    ],
    [
      'a small thumbnail (zoom=5)',
      'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api',
      `${G}?id=abc&printsec=frontcover&img=1&source=gbs_api&zoom=1&fife=w800`,
    ],
    ['an https URL with a fife already', `${G}?id=abc&zoom=0&fife=w200`, `${G}?id=abc&zoom=1&fife=w800`],
    ['a country domain', 'https://books.google.ca/books/content?id=abc&img=1', 'https://books.google.ca/books/content?id=abc&img=1&zoom=1&fife=w800'],
  ])('%s', (_name, input, expected) => {
    expect(upgradeGoogleCoverUrl(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'https://example.com/cover.jpg', 'https://covers.openlibrary.org/b/id/1-L.jpg'])('ignores %p', (input) => {
    expect(upgradeGoogleCoverUrl(input)).toBeNull();
  });

  it('builds the same form from a volume id', () => {
    expect(googleCoverUrlForVolume('7YBX8sWHq4sC')).toBe(`${G}?id=7YBX8sWHq4sC&printsec=frontcover&img=1&zoom=1&fife=w800`);
  });
});

describe('cover sources', () => {
  it('takes every pointer from a merged candidate', () => {
    const candidate = makeCandidate({
      title: 'The Colour of Magic',
      source: 'openlibrary',
      sourceId: 'OL28477029M',
      isbn13: '9780552166591',
      coverRefs: { olEditionCoverIds: [14647238], olWorkCoverIds: [13642933], googleVolumeId: 'g1', googleImageUrl: 'http://x' },
    });
    expect(coverSourceFromCandidate(candidate)).toEqual({
      isbn13: '9780552166591',
      isbn10: null,
      olEditionCoverIds: [14647238],
      olEditionId: 'OL28477029M',
      olWorkCoverIds: [13642933],
      googleVolumeId: 'g1',
      googleImageUrl: 'http://x',
    });
  });

  it('does not treat a work id as an edition id', () => {
    const work = makeCandidate({ kind: 'work', title: 'Dune', source: 'openlibrary', sourceId: 'OL893414W' });
    expect(coverSourceFromCandidate(work).olEditionId).toBeNull();
  });

  it.each([
    ['openlibrary', 'OL28477029M', { olEditionId: 'OL28477029M', googleVolumeId: null }],
    ['googlebooks', 'g1', { olEditionId: null, googleVolumeId: 'g1' }],
    ['manual', null, { olEditionId: null, googleVolumeId: null }],
  ] as const)('reads a stored %s book', (source, sourceId, expected) => {
    expect(coverSourceFromBook({ isbn13: '9780552166591', isbn10: null, source, sourceId })).toMatchObject({ isbn13: '9780552166591', ...expected });
  });

  it('combines sources, the first winning', () => {
    expect(
      combineCoverSources({ isbn13: 'a', olEditionCoverIds: [], googleVolumeId: null }, { isbn13: 'b', olEditionCoverIds: [5], googleVolumeId: 'g' }),
    ).toMatchObject({ isbn13: 'a', olEditionCoverIds: [5], googleVolumeId: 'g' });
  });
});
