import { sortableTitle } from './book';

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

const letters = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
