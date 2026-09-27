import { sortableTitle } from './book';
import { stripDiacritics } from './text';

/** Library class codes for the starter genres; any other genre uses its first three letters. */
const CLASS_CODES: Record<string, string> = {
  fiction: 'FIC',
  fantasy: 'FIC',
  'science fiction': 'FIC',
  mystery: 'FIC',
  thriller: 'FIC',
  romance: 'FIC',
  'historical fiction': 'FIC',
  horror: 'FIC',
  'literary fiction': 'FIC',
  classics: 'FIC',
  'young adult': 'YA',
  "children's": 'JUV',
  'graphic novel': 'GN',
  poetry: 'POE',
  biography: 'BIO',
  memoir: 'BIO',
  history: 'HIS',
  science: 'SCI',
  philosophy: 'PHI',
  'self-help': 'SLF',
  cookery: 'COO',
  travel: 'TRA',
  art: 'ART',
  religion: 'REL',
  business: 'BUS',
  reference: 'REF',
};

/** Plain Latin capitals: accents dropped, and letters with none to drop spelt out ("Øster" → OSTER, "Æsop" → AESOP). */
const letters = (s: string) =>
  stripDiacritics(s)
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();

/** Non-fiction genres, most specific first: a memoir about cooking shelves as BIO, a history of science as HIS. */
const NON_FICTION_ORDER = ['biography', 'memoir', 'cookery', 'self-help', 'travel', 'art', 'religion', 'philosophy', 'history', 'science', 'business', 'reference'];
const FICTION_KINDS = new Set(['fantasy', 'science fiction', 'mystery', 'thriller', 'romance', 'historical fiction', 'horror', 'literary fiction', 'classics']);

/**
 * The class for a set of genres, whatever order they come in (the book page
 * lists them alphabetically): graphic novels, children's and young adult
 * books have their own shelves (GN, JUV, YA); otherwise a non-fiction genre
 * wins unless a kind of novel (Fantasy, Romance…) says it is fiction, so a
 * memoir also tagged "Fiction" files as BIO and a historical novel tagged
 * "History" as FIC. Then poetry, plain "Fiction", the first letters of a
 * genre of the user's own, and GEN with none.
 */
function classFor(genres: readonly string[]): string {
  const names = genres.map((g) => g.trim().toLowerCase()).filter(Boolean);
  const has = (name: string) => names.includes(name);
  const novel = names.some((n) => FICTION_KINDS.has(n));
  const nonFiction = NON_FICTION_ORDER.find(has);
  if (has('graphic novel')) return 'GN';
  if (has("children's")) return 'JUV';
  if (has('young adult')) return 'YA';
  if (nonFiction && !novel) return CLASS_CODES[nonFiction];
  if (novel) return 'FIC';
  if (has('poetry')) return 'POE';
  if (has('fiction')) return 'FIC';
  const own = names.find((n) => !(n in CLASS_CODES));
  return (own && letters(own).slice(0, 3)) || 'GEN';
}

/**
 * Which version of the rules below made a call number. The database keeps
 * each book's call number (`book_sort_keys`, filled in by
 * src/db/callNumbers.ts) so the Shelf can sort by it: bump this whenever
 * `callNumber` would print something different for the same book, and every
 * stored call number is worked out again before it is next read.
 */
export const CALL_NUMBER_RULES = 1;

export interface CallNumberInput {
  genres: readonly string[];
  /** The first author's sort name ("Pratchett, Terry") or name. */
  author: string | null;
  title: string;
  year: number | null;
}

/**
 * A catalogue-card call number: class, author mark, year — "FIC PRA 1987".
 * The class comes from all the book's genres (`classFor`), so it does not
 * depend on their order; the mark is the first three letters of the
 * author's surname, or of the title when there is no author.
 */
export function callNumber({ genres, author, title, year }: CallNumberInput): string {
  const cls = classFor(genres);
  const surname = author ? (author.includes(',') ? author.split(',')[0] : author.trim().split(/\s+/).pop()!) : null;
  const mark = letters(surname ?? sortableTitle(title)).slice(0, 3) || 'XXX';
  return [cls, mark, year != null ? String(year) : null].filter(Boolean).join(' ');
}
