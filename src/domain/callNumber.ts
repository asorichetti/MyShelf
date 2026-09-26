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

export interface CallNumberInput {
  genres: readonly string[];
  /** The first author's sort name ("Pratchett, Terry") or name. */
  author: string | null;
  title: string;
  year: number | null;
}

/**
 * A catalogue-card call number: class, author mark, year — "FIC PRA 1987".
 * The class comes from the first genre (GEN with none); the mark is the first
 * three letters of the author's surname, or of the title when there is no
 * author.
 */
export function callNumber({ genres, author, title, year }: CallNumberInput): string {
  const genre = genres[0]?.trim().toLowerCase();
  const cls = !genre ? 'GEN' : (CLASS_CODES[genre] ?? (letters(genre).slice(0, 3) || 'GEN'));
  const surname = author ? (author.includes(',') ? author.split(',')[0] : author.trim().split(/\s+/).pop()!) : null;
  const mark = letters(surname ?? sortableTitle(title)).slice(0, 3) || 'XXX';
  return [cls, mark, year != null ? String(year) : null].filter(Boolean).join(' ');
}
