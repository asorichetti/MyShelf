import { isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn, type BookFormat } from '@/domain';
import { toIso6391 } from '@/domain/languages';
import { parseSeriesString } from '@/domain/seriesParser';

import { emptyCoverRefs, makeCandidate } from './candidate';

import type { BookCandidate, SeriesHint } from './types';

/** Open Library text fields are a string or `{ type: '/type/text', value }`. */
export type OlText = string | { type?: string; value?: string };

/** An edition from `/isbn/{isbn}.json`, `/books/{olid}.json` or a work's `editions.json` entries. Every field optional. */
export interface OlEdition {
  key?: string;
  title?: string;
  subtitle?: string;
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  pagination?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  works?: { key?: string }[];
  authors?: { key?: string }[];
  series?: string[];
  languages?: { key?: string }[];
  physical_format?: string;
  edition_name?: string;
  subjects?: string[];
  description?: OlText;
}

/** A work from `/works/{id}.json`. */
export interface OlWork {
  key?: string;
  title?: string;
  description?: OlText;
  subjects?: string[];
  authors?: { author?: { key?: string } }[];
  covers?: number[];
}

/** An author from `/authors/{id}.json`. */
export interface OlAuthor {
  key?: string;
  name?: string;
  personal_name?: string;
}

/** A document from `/search.json` with the fields we request. */
export interface OlSearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  edition_count?: number;
  isbn?: string[];
  cover_i?: number;
  subject?: string[];
  language?: string[];
}

export interface OlSearchResponse {
  numFound?: number;
  docs?: OlSearchDoc[];
}

export interface OlEditionsResponse {
  size?: number;
  entries?: OlEdition[];
}

export const COVERS_BASE = 'https://covers.openlibrary.org';

/** "/books/OL28477029M" → "OL28477029M". */
export function olid(key: string | null | undefined): string | null {
  if (!key) return null;
  const id = key.split('/').filter(Boolean).pop();
  return id || null;
}

/** Large cover URL for an Open Library cover id; ids ≤ 0 mean "no cover". */
export function coverUrlFromId(id: number | null | undefined, size: 'S' | 'M' | 'L' = 'L'): string | null {
  return typeof id === 'number' && id > 0 ? `${COVERS_BASE}/b/id/${id}-${size}.jpg` : null;
}

/** Real cover ids from a `covers[]` list: Open Library uses `-1` for "no cover". */
export function coverIds(ids: readonly number[] | null | undefined): number[] {
  return (ids ?? []).filter((id) => Number.isInteger(id) && id > 0);
}

/** First plausible 4-digit year in free text: "March 2007" → 2007, "Jul 12, 2019" → 2019. */
export function parsePublishYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = /(?:^|\D)(1[4-9]\d\d|20\d\d)(?!\d)/.exec(text);
  return m ? Number(m[1]) : null;
}

/** Plain text of an Open Library description, with its Markdown and trailing "see also" block removed. */
export function descriptionText(value: OlText | null | undefined): string | null {
  const raw = typeof value === 'string' ? value : value?.value;
  if (!raw) return null;
  const text = raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split(/\n-{3,}\s*\n/)[0] // "----------" introduces "Also contained in:" link lists
    .replace(/^\s*\[back cover\]\s*/i, '')
    .replace(/\n\s*--\s*back cover\s*$/i, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url)
    .replace(/(\*\*|\*)(\S(?:[^*]*?\S)?)\1/g, '$2') // *emphasis*, **strong**
    .replace(/(^|\s)_(\S(?:[^_]*?\S)?)_(?=\s|[.,;:!?)]|$)/gm, '$1$2') // _emphasis_, not snake_case
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}

/** Normalises Open Library's free-text `physical_format` (any language, any case). */
export function mapPhysicalFormat(text: string | null | undefined): BookFormat | null {
  if (!text) return null;
  const s = text.toLowerCase();
  if (/audio|cassette|mp3|\bcd\b|audiobook|hörbuch/.test(s)) return 'audiobook';
  if (/e-?book|electronic|kindle|epub|digital|online/.test(s)) return 'ebook';
  if (/paper|mass market|soft|trade|brochura|broché|broschiert|taschenbuch|rústica|tascabile/.test(s)) return 'paperback';
  if (/hard|cloth|library binding|board|gebunden|relié|cartonné|tapa dura|leather/.test(s)) return 'hardcover';
  return 'other';
}

/** Page count from `number_of_pages`, or the largest arabic number in `pagination` ("xlii, 435 p."). */
export function mapPageCount(edition: Pick<OlEdition, 'number_of_pages' | 'pagination'>): number | null {
  if (typeof edition.number_of_pages === 'number' && edition.number_of_pages > 0) return edition.number_of_pages;
  const numbers = (edition.pagination ?? '').match(/\d+/g)?.map(Number) ?? [];
  const max = Math.max(0, ...numbers);
  return max > 0 ? max : null;
}

function validIsbns(list: string[] | undefined, valid: (s: string) => boolean): string[] {
  return (list ?? []).map((s) => normalizeIsbn(s)).filter((s): s is string => !!s && valid(s));
}

/**
 * Trimmed, NFC-normalised text or null. Some records store decomposed
 * accents ("n" + U+0303 for "ñ"), which look identical but compare unequal.
 */
export function cleanText(value: string | null | undefined): string | null {
  const t = value?.normalize('NFC').replace(/\s+/g, ' ').trim();
  return t || null;
}

/** Case-insensitive de-duplication, keeping first spelling and order. */
export function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = cleanText(v);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

/** Open Library `series[]` strings → parsed hints. Imprints ("Penguin Classics") are dropped. */
export function mapSeriesHints(series: string[] | undefined): SeriesHint[] {
  const hints: SeriesHint[] = [];
  for (const raw of series ?? []) {
    const parsed = parseSeriesString(raw);
    if (parsed) hints.push({ ...parsed, source: 'openlibrary', raw });
  }
  return hints;
}

export interface MapEditionContext {
  work?: OlWork | null;
  /** Author display names, resolved from the edition's (or work's) author keys. */
  authors?: string[];
  /** The ISBN-13 that was looked up; Open Library resolved it to this edition. */
  requestedIsbn13?: string | null;
  confidence?: number;
}

/** Maps an edition (plus its work and authors) to a candidate, per PLAN §6. */
export function mapEdition(edition: OlEdition, context: MapEditionContext = {}): BookCandidate {
  const { work, authors = [], requestedIsbn13 = null } = context;
  const isbn13s = validIsbns(edition.isbn_13, isValidIsbn13);
  const isbn10s = validIsbns(edition.isbn_10, isValidIsbn10);
  const isbn13 = requestedIsbn13 ?? isbn13s[0] ?? (isbn10s[0] ? isbn10To13(isbn10s[0]) : null);
  const isbn10 = isbn10s.find((i) => isbn10To13(i) === isbn13) ?? (isbn13 ? isbn13To10(isbn13) : null) ?? isbn10s[0] ?? null;
  const workKey = olid(edition.works?.[0]?.key ?? work?.key);
  return makeCandidate({
    kind: 'edition',
    title: cleanText(edition.title) ?? cleanText(work?.title) ?? 'Untitled',
    subtitle: cleanText(edition.subtitle),
    authors: uniqueStrings(authors),
    publisher: cleanText(edition.publishers?.[0]),
    publicationYear: parsePublishYear(edition.publish_date),
    pageCount: mapPageCount(edition),
    isbn13,
    isbn10,
    edition: cleanText(edition.edition_name),
    language: toIso6391(edition.languages?.[0]?.key),
    format: mapPhysicalFormat(edition.physical_format),
    summary: descriptionText(work?.description) ?? descriptionText(edition.description),
    coverUrl: coverUrlFromId(edition.covers?.find((c) => c > 0) ?? work?.covers?.find((c) => c > 0)),
    coverRefs: { ...emptyCoverRefs(), olEditionCoverIds: coverIds(edition.covers), olWorkCoverIds: coverIds(work?.covers) },
    subjects: uniqueStrings([...(edition.subjects ?? []), ...(work?.subjects ?? [])]),
    seriesHints: mapSeriesHints(edition.series),
    workKey,
    source: 'openlibrary',
    sourceId: olid(edition.key) ?? workKey ?? isbn13 ?? 'unknown',
    confidence: context.confidence ?? 0.5,
  });
}

/** Author keys for an edition: its own, else its work's. */
export function authorKeys(edition: OlEdition, work?: OlWork | null): string[] {
  const own = (edition.authors ?? []).map((a) => olid(a.key)).filter((k): k is string => !!k);
  if (own.length) return uniqueStrings(own);
  return uniqueStrings((work?.authors ?? []).map((a) => olid(a.author?.key)));
}

/** A search document is a work: edition facts (ISBN, publisher, pages, format) stay empty. */
export function mapSearchDoc(doc: OlSearchDoc): BookCandidate | null {
  const workKey = olid(doc.key);
  const title = cleanText(doc.title);
  if (!workKey || !title) return null;
  const languages = uniqueStrings((doc.language ?? []).map((l) => toIso6391(l)));
  return makeCandidate({
    kind: 'work',
    title,
    authors: uniqueStrings(doc.author_name ?? []),
    publicationYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
    language: languages.length === 1 ? languages[0] : null,
    languages,
    coverUrl: coverUrlFromId(doc.cover_i),
    coverRefs: { ...emptyCoverRefs(), olWorkCoverIds: coverIds(doc.cover_i === undefined ? [] : [doc.cover_i]) },
    subjects: uniqueStrings(doc.subject ?? []),
    workKey,
    editionCount: typeof doc.edition_count === 'number' ? doc.edition_count : null,
    source: 'openlibrary',
    sourceId: workKey,
  });
}
