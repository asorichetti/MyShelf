import { isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '@/domain';
import { toIso6391 } from '@/domain/languages';
import { parsePosition, parseSeriesString } from '@/domain/seriesParser';
import { stripHtml } from '@/domain/text';

import { emptyCoverRefs, makeCandidate } from './candidate';
import { cleanText, plausiblePageCount, plausibleYear, uniqueStrings } from './openLibraryMap';

import type { BookCandidate, SeriesHint } from './types';

/** `volumeInfo` fields requested with the `fields=` filter (PLAN §6). Every field optional. */
export interface GbVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: { type?: string; identifier?: string }[];
  pageCount?: number;
  categories?: string[];
  imageLinks?: { smallThumbnail?: string; thumbnail?: string };
  language?: string;
  seriesInfo?: { bookDisplayNumber?: string; volumeSeries?: { seriesId?: string; orderNumber?: number }[] };
}

export interface GbVolume {
  id?: string;
  volumeInfo?: GbVolumeInfo;
}

/** `/volumes` response. With a `fields=` filter and no matches, Google sends `{ totalItems: 0 }` (or `{}`). */
export interface GbVolumesResponse {
  totalItems?: number;
  items?: GbVolume[];
}

/** "2012-05-10", "2007-03" or "1985" → the year. */
export function parsePublishedDate(value: string | null | undefined): number | null {
  const m = /^\s*(\d{4})/.exec(value ?? '');
  return m ? plausibleYear(Number(m[1])) : null;
}

/** Cover thumbnail over HTTPS, without the curled-page effect. */
export function coverFromImageLinks(links: GbVolumeInfo['imageLinks']): string | null {
  const url = links?.thumbnail ?? links?.smallThumbnail;
  if (!url) return null;
  return url
    .replace(/^http:\/\//i, 'https://')
    .replace(/&edge=curl\b/g, '')
    .replace(/\?edge=curl(?:&|$)/, '?')
    .replace(/\?$/, '');
}

/** ISBN-13 and ISBN-10 from `industryIdentifiers`, each derived from the other when missing. */
export function isbnsFromIdentifiers(ids: GbVolumeInfo['industryIdentifiers']): { isbn13: string | null; isbn10: string | null } {
  let isbn13: string | null = null;
  let isbn10: string | null = null;
  for (const id of ids ?? []) {
    const value = normalizeIsbn(id.identifier);
    if (!value) continue;
    if (id.type === 'ISBN_13' && !isbn13 && isValidIsbn13(value)) isbn13 = value;
    if (id.type === 'ISBN_10' && !isbn10 && isValidIsbn10(value)) isbn10 = value;
  }
  return { isbn13: isbn13 ?? (isbn10 ? isbn10To13(isbn10) : null), isbn10: isbn10 ?? (isbn13 ? isbn13To10(isbn13) : null) };
}

/** `seriesInfo.bookDisplayNumber` → a position-only hint (Google Books gives no series name). */
export function seriesHintFromInfo(info: GbVolumeInfo['seriesInfo']): SeriesHint[] {
  const order = info?.volumeSeries?.find((s) => typeof s.orderNumber === 'number')?.orderNumber;
  const position = parsePosition(info?.bookDisplayNumber) ?? (typeof order === 'number' ? parsePosition(String(order)) : null);
  return position != null ? [{ name: null, position, source: 'googlebooks', raw: info?.bookDisplayNumber ?? String(position) }] : [];
}

/**
 * Google Books puts series numbers in parentheses in the subtitle
 * ("(Discworld Novel 1)"); that is not a subtitle a reader would type.
 */
function cleanSubtitle(subtitle: string | undefined): string | null {
  const s = cleanText(subtitle);
  return s && /^\(.*\)$/.test(s) ? null : s;
}

/** Maps a volume to a candidate, per PLAN §6. Null when it has no id or title. */
export function mapVolume(volume: GbVolume, confidence = 0.5): BookCandidate | null {
  const info = volume.volumeInfo ?? {};
  const title = cleanText(info.title);
  if (!volume.id || !title) return null;
  const subtitle = cleanText(info.subtitle);
  const { isbn13, isbn10 } = isbnsFromIdentifiers(info.industryIdentifiers);
  const seriesHints = seriesHintFromInfo(info.seriesInfo);
  // A parenthesised subtitle like "(Discworld Novel 1)" names the series; keep it as a hint.
  const fromSubtitle = subtitle && /^\(.*\)$/.test(subtitle) ? parseSeriesString(subtitle) : null;
  if (fromSubtitle) seriesHints.push({ ...fromSubtitle, source: 'googlebooks', raw: subtitle! });
  return makeCandidate({
    kind: 'edition',
    title,
    subtitle: cleanSubtitle(info.subtitle),
    authors: uniqueStrings(info.authors ?? []),
    publisher: cleanText(info.publisher),
    publicationYear: parsePublishedDate(info.publishedDate),
    pageCount: plausiblePageCount(info.pageCount),
    isbn13,
    isbn10,
    language: toIso6391(info.language),
    summary: stripHtml(info.description),
    coverUrl: coverFromImageLinks(info.imageLinks),
    coverRefs: {
      ...emptyCoverRefs(),
      googleVolumeId: volume.id,
      googleImageUrl: info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
    },
    subjects: uniqueStrings(info.categories ?? []),
    seriesHints,
    source: 'googlebooks',
    sourceId: volume.id,
    confidence,
  });
}
