import { isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '@/domain';

/** Where a cover URL came from, in the order the chain tries them (PLAN §6 "Covers: real art first"). */
export type CoverOrigin =
  | 'openlibrary-edition'
  | 'openlibrary-olid'
  | 'openlibrary-work'
  | 'openlibrary-isbn13'
  | 'openlibrary-isbn10'
  | 'googlebooks';

/**
 * What is known about a book that can lead to a cover: from a merged lookup
 * candidate (`coverSourceFromCandidate`) or a stored book. Every field is
 * optional; the more there is, the more places the chain can look.
 */
export interface CoverSource {
  isbn13?: string | null;
  isbn10?: string | null;
  /** Open Library cover ids on the edition record (`covers[]`), best first. */
  olEditionCoverIds?: readonly number[];
  /** Open Library edition id (`OL28477029M`), for a stored book that kept no cover ids. */
  olEditionId?: string | null;
  /** Open Library cover ids on the work record, best first. */
  olWorkCoverIds?: readonly number[];
  /** Google Books volume id. */
  googleVolumeId?: string | null;
  /** Google Books `imageLinks.thumbnail` (or `smallThumbnail`) as the API sent it. */
  googleImageUrl?: string | null;
}

export interface CoverCandidate {
  url: string;
  origin: CoverOrigin;
}

export const OL_COVERS_BASE = 'https://covers.openlibrary.org';
export const GOOGLE_COVERS_BASE = 'https://books.google.com/books/content';

/**
 * Width asked of Google's image server. Verified September 2026: a
 * `zoom=1` thumbnail is 128 px wide; adding `fife=w800` returns the same
 * cover at up to 800 px (e.g. 800×1247) when the scan is that large, and at
 * its native size when it is smaller.
 */
export const GOOGLE_COVER_WIDTH = 800;

/** Large cover by Open Library cover id. Cover ids are not rate-limited, so these come first. */
export function olCoverByIdUrl(id: number): string {
  return `${OL_COVERS_BASE}/b/id/${id}-L.jpg`;
}

/**
 * Large cover by ISBN or edition id. `default=false` makes a missing cover a
 * 404; without it Open Library answers 200 with a 1×1 GIF. These lookups
 * are rate-limited per IP (100 per 5 minutes), so they come after cover ids.
 */
export function olCoverByKeyUrl(key: 'isbn' | 'olid', value: string): string {
  return `${OL_COVERS_BASE}/b/${key}/${encodeURIComponent(value)}-L.jpg?default=false`;
}

/** The front cover of a Google Books volume, in the upgraded form below. */
export function googleCoverUrlForVolume(volumeId: string): string {
  return `${GOOGLE_COVERS_BASE}?id=${encodeURIComponent(volumeId)}&printsec=frontcover&img=1&zoom=1&fife=w${GOOGLE_COVER_WIDTH}`;
}

/**
 * Google Books `imageLinks` URL → the largest reliable image of the same
 * cover: HTTPS, no `edge=curl` (a drawn page curl), `zoom=1` and
 * `fife=w800`. Tested against books.google.com in September 2026:
 * - `fife=w800` scales the cover up to 800 px wide (128×200 → 800×1247),
 *   whatever the `zoom`, and never past the scan's own size.
 * - `zoom=0` is not used: it returned the full-size cover for one volume,
 *   but a cropped detail of the art for another, a thin 575×92 strip for a
 *   third, and an "image not available" PNG for a book with no scan.
 * - `zoom=2…4` gave fixed larger sizes (300, 575, 800 px wide) for the one
 *   volume tried; `fife` asks for the width directly, so it is the knob used.
 * Returns null for anything that is not a Google Books content URL.
 */
export function upgradeGoogleCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const https = url.trim().replace(/^http:\/\//i, 'https://');
  const match = /^https:\/\/books\.google\.[a-z.]+\/books\/content\?(.*)$/i.exec(https);
  if (!match) return null;
  const [base] = https.split('?');
  const params = match[1]
    .split('&')
    .filter(Boolean)
    .filter((p) => !/^(edge|zoom|fife)=/i.test(p));
  return `${base}?${[...params, 'zoom=1', `fife=w${GOOGLE_COVER_WIDTH}`].join('&')}`;
}

const positive = (ids: readonly number[] | undefined) => (ids ?? []).filter((id) => Number.isInteger(id) && id > 0);

/**
 * The places to look for a cover, best first, without duplicates:
 * 1. the Open Library edition's cover id (or, for a stored book, its edition id);
 * 2. the work's cover id (the cover Open Library shows for the book as a whole);
 * 3. Open Library by ISBN-13, then ISBN-10;
 * 4. Google Books, upgraded to its largest reliable size (skipped when
 *    `includeGoogle` is false, i.e. the user turned Google Books off).
 * Only the first id of each record is used: it is the one the record shows.
 */
export function coverCandidates(source: CoverSource, { includeGoogle = true }: { includeGoogle?: boolean } = {}): CoverCandidate[] {
  const out: CoverCandidate[] = [];
  const add = (url: string | null, origin: CoverOrigin) => {
    if (url && !out.some((c) => c.url === url)) out.push({ url, origin });
  };

  const [editionId] = positive(source.olEditionCoverIds);
  if (editionId) add(olCoverByIdUrl(editionId), 'openlibrary-edition');
  else if (source.olEditionId && /^OL\d+M$/.test(source.olEditionId)) add(olCoverByKeyUrl('olid', source.olEditionId), 'openlibrary-olid');

  const [workId] = positive(source.olWorkCoverIds);
  if (workId) add(olCoverByIdUrl(workId), 'openlibrary-work');

  const raw13 = normalizeIsbn(source.isbn13);
  const raw10 = normalizeIsbn(source.isbn10);
  const isbn13 = raw13 && isValidIsbn13(raw13) ? raw13 : raw10 && isValidIsbn10(raw10) ? isbn10To13(raw10) : null;
  const isbn10 = raw10 && isValidIsbn10(raw10) ? raw10 : isbn13 ? isbn13To10(isbn13) : null;
  if (isbn13) add(olCoverByKeyUrl('isbn', isbn13), 'openlibrary-isbn13');
  if (isbn10) add(olCoverByKeyUrl('isbn', isbn10), 'openlibrary-isbn10');

  if (includeGoogle) {
    const google =
      upgradeGoogleCoverUrl(source.googleImageUrl) ?? (source.googleVolumeId ? googleCoverUrlForVolume(source.googleVolumeId) : null);
    add(google, 'googlebooks');
  }
  return out;
}
