import { normaliseText } from './text';

/**
 * Series extraction from provider hints and title patterns (P02-08).
 * Everything here is a guess the user confirms: results carry a confidence.
 */

export type SeriesConfidence = 'high' | 'medium' | 'low';

export interface ParsedSeries {
  name: string;
  position: number | null;
}

export interface SeriesMatch extends ParsedSeries {
  /**
   * `high`: a provider's series field with a position (applied directly,
   * still editable); `medium`: a series field without a position, or a
   * title pattern with one; `low`: a title pattern without a position.
   */
  confidence: SeriesConfidence;
}

/** A provider hint: named (Open Library `series[]`) or position-only (Google Books). */
export interface SeriesHintInput {
  name: string | null;
  position: number | null;
  source: string;
  raw?: string;
}

export interface SeriesSource {
  title: string;
  subtitle?: string | null;
  seriesHints?: readonly SeriesHintInput[];
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

/** "IV" → 4; null for anything that is not a well-formed numeral from 1 to 3999. */
export function parseRoman(text: string): number | null {
  const s = text.toLowerCase();
  if (!/^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/.test(s) || !s) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]];
    total += i + 1 < s.length && ROMAN[s[i + 1]] > v ? -v : v;
  }
  return total;
}

/** "5" → 5, "2.5" / "2,5" → 2.5, "IV" → 4 (up to LX), "three" → 3; null otherwise. */
export function parsePosition(text: string | null | undefined): number | null {
  if (text == null) return null;
  const s = text.trim().replace(/^#\s*/, '').replace(/\.$/, '');
  if (/^\d+(?:[.,]\d+)?$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    return n > 0 && n < 10_000 ? n : null;
  }
  const word = WORD_NUMBERS[s.toLowerCase()];
  if (word) return word;
  // Series rarely run past a few dozen; "D" or "M" alone is far likelier a letter than 500.
  const roman = parseRoman(s);
  return roman != null && roman <= 60 ? roman : null;
}

/** Publisher imprint "series" that are not reading series. Compared after normalisation. */
const IMPRINTS = [
  'penguin classics', 'penguin modern classics', 'penguin popular classics', 'penguin english library',
  'penguin great ideas', 'penguin red classics', 'puffin classics', 'puffin books', 'everymans library',
  'everymans library classics', 'everymans library childrens classics', 'oxford worlds classics',
  'oxford classics', 'worlds classics', 'vintage classics', 'vintage international', 'wordsworth classics',
  'collins classics', 'bantam classics', 'signet classics', 'modern library', 'modern library classics',
  'barnes and noble classics', 'dover thrift editions', 'folio', 'folio junior', 'collection folio', 'folio plus',
  'livre de poche', 'le livre de poche', 'pocket', 'penguin readers', 'oxford bookworms', 'ladybird books',
  'ladybird', 'virago modern classics', 'faber classics', 'harper perennial modern classics',
  'penguin twentieth century classics', 'library of america', 'loeb classical library', 'large print',
  'thorndike press large print', 'debolsillo', 'contemporanea', 'a tor book', 'tor fantasy',
];
const IMPRINT_KEYS = new Set(IMPRINTS.map((s) => normaliseText(s, { dropArticle: false })));
/** Endings that mark a publisher's list rather than a story sequence. */
const IMPRINT_SUFFIX = /\b(?:classics|classic library|library|editions?|collection|paperbacks|large print|readers)$/;

/** True for a publisher imprint or list ("Penguin Classics", "Everyman's Library"). */
export function isImprintSeries(name: string): boolean {
  const key = normaliseText(name, { dropArticle: false });
  return IMPRINT_KEYS.has(key) || IMPRINT_SUFFIX.test(key);
}

const POS = String.raw`(\d+(?:[.,]\d+)?|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`;
const KEYWORD = String.raw`(?:book|bk\.?|vol\.?|volume|part|pt\.?|tome|t\.|band|bd\.?|livre|libro|tomo|novel|number|no\.?|nr\.?|nº)`;

/** Tidies a series name: trims punctuation, drops "A … Novel" and a trailing "series". */
export function cleanSeriesName(raw: string): string {
  let s = raw.trim().replace(/^[\s([{"'“‘]+|[\s)\]}"'”’.,;:#-]+$/g, '');
  s = s.replace(/^an?\s+(.+?)\s+(?:novel|novels|book|mystery|thriller|story|adventure)$/i, '$1');
  s = s.replace(/\s+(?:novels?|series|sequence|serie|reihe)$/i, '');
  s = s.replace(/\s*\((?:series)?\)$/i, '');
  return s.trim();
}

function validName(name: string): boolean {
  return /\p{L}/u.test(name) && name.length <= 80 && !isImprintSeries(name);
}

function result(name: string, position: string | null): ParsedSeries | null {
  const clean = cleanSeriesName(name);
  if (!validName(clean)) return null;
  return { name: clean, position: parsePosition(position) };
}

/**
 * Parses a provider's series text: `"Discworld ; 5"`, `"Harry Potter -- 1"`,
 * `"Discworld novel, 5"`, `"The Expanse #3"`, `"Discworld, Book 1"`,
 * `"Discworld (1)"`, `"Dune chronicles -- bk. 1"`, `"Świat Dysku, Part I"`.
 * Returns null for imprints and empty text.
 */
export function parseSeriesString(raw: string | null | undefined): ParsedSeries | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^\((.*)\)$/, '$1').trim();
  if (!s) return null;
  const patterns: RegExp[] = [
    // "Discworld, Book 1", "Dune chronicles -- bk. 1", "Discworld Vol. 1", "Świat Dysku, Part I"
    new RegExp(String.raw`^(.*?)[\s;,:–—-]*\b${KEYWORD}\s*#?\s*${POS}$`, 'iu'),
    // "Discworld ; 5", "Harry Potter -- 1", "Discworld novel, 5", "Harry Potter, #1"
    new RegExp(String.raw`^(.*?)\s*(?:;|--|–|—|,)\s*#?\s*${POS}$`, 'iu'),
    // "The Expanse #3", "Discworld #1"
    new RegExp(String.raw`^(.*?)\s*#\s*${POS}$`, 'iu'),
    // "Discworld (1)", "Discworld (Book 1)"
    new RegExp(String.raw`^(.*?)\s*\(\s*(?:${KEYWORD}\s*)?#?\s*${POS}\s*\)$`, 'iu'),
    // "Discworld 5" (digits only: a bare trailing numeral is too ambiguous)
    /^(.*?\p{L}.*?)\s+(\d+(?:\.\d+)?)$/u,
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(s);
    // A "position" that does not parse ("Mild") means the pattern misread a name.
    if (m && m[1].trim() && parsePosition(m[2]) != null) return result(m[1], m[2]);
  }
  return result(s, null);
}

/**
 * Finds a series in a title or subtitle: `"Title (Series Name, #3)"`,
 * `"Title (Series Name Book 3)"`, `"Series Name Book 3: Title"`,
 * `"Title: A Series Name Novel"` (no position), subtitle
 * `"Book Three of the Wheel of Time"` or `"The Stormlight Archive, Book 1"`.
 */
export function parseSeriesFromTitle(title: string, subtitle?: string | null): ParsedSeries | null {
  const t = title.trim();
  const inParens = new RegExp(String.raw`\(([^()]+?)[\s,;]*(?:#|${KEYWORD})\s*${POS}\)\s*$`, 'iu').exec(t);
  if (inParens) return result(inParens[1], inParens[2]);
  const leading = new RegExp(String.raw`^(.+?)[\s,]+(?:book|vol\.?|volume|part)\s+${POS}\s*[:–—-]\s*\S`, 'iu').exec(t);
  if (leading) return result(leading[1], leading[2]);

  const tails = [subtitle?.trim(), /:\s*(.+)$/.exec(t)?.[1]].filter((x): x is string => !!x);
  for (const tail of tails) {
    const ofThe = new RegExp(String.raw`^(?:book|volume|part)\s+${POS}\s+(?:of|in)\s+(?:the\s+)?(.+)$`, 'iu').exec(tail);
    if (ofThe) return result(ofThe[2], ofThe[1]);
    const novel = /^an?\s+(.+?)\s+(?:novel|book|mystery|thriller|story|adventure)$/i.exec(tail);
    if (novel) return result(novel[1], null);
    const keyed = new RegExp(String.raw`^(.+?)[\s,;]+(?:book|vol\.?|volume|part)\s+${POS}$`, 'iu').exec(tail);
    if (keyed) return result(keyed[1], keyed[2]);
  }
  return null;
}

const RANK: Record<SeriesConfidence, number> = { low: 1, medium: 2, high: 3 };

/**
 * Combines every clue about a candidate's series into one guess, or null.
 * Named hints (Open Library `series[]`) beat title patterns; a Google Books
 * position (`bookDisplayNumber`) fills in a missing position. Imprints such
 * as "Penguin Classics" are ignored.
 */
export function extractSeries(source: SeriesSource): SeriesMatch | null {
  const found: SeriesMatch[] = [];
  const positionOnly: number[] = [];
  for (const hint of source.seriesHints ?? []) {
    if (!hint.name) {
      if (hint.position != null) positionOnly.push(hint.position);
      continue;
    }
    const parsed = hint.position != null ? result(hint.name, String(hint.position)) : parseSeriesString(hint.raw ?? hint.name);
    if (!parsed) continue;
    const position = parsed.position ?? hint.position;
    found.push({ name: parsed.name, position, confidence: position != null ? 'high' : 'medium' });
  }
  const fromTitle = parseSeriesFromTitle(source.title, source.subtitle);
  if (fromTitle) found.push({ ...fromTitle, confidence: fromTitle.position != null ? 'medium' : 'low' });
  if (!found.length) return null;

  // Group hints naming the same series; the best-supported group wins.
  const groups = new Map<string, SeriesMatch[]>();
  for (const f of found) {
    const key = normaliseText(f.name);
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  let best: SeriesMatch[] | null = null;
  const score = (g: SeriesMatch[]) => Math.max(...g.map((m) => RANK[m.confidence])) * 10 + g.length;
  for (const g of groups.values()) if (!best || score(g) > score(best)) best = g;
  const group = [...best!].sort((a, b) => RANK[b.confidence] - RANK[a.confidence]);
  const withPosition = group.find((m) => m.position != null);
  const name = (withPosition ?? group[0]).name;
  let position = withPosition?.position ?? null;
  let confidence = withPosition?.confidence ?? group[0].confidence;
  if (position == null && positionOnly.length) {
    position = positionOnly[0];
    confidence = 'medium';
  }
  return { name, position, confidence };
}
