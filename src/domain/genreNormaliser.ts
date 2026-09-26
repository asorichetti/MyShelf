import { nonFictionGenres, type CuratedGenre } from './genres';
import { stripDiacritics } from './text';

/**
 * Maps provider subjects (Open Library `subjects`, Google Books BISAC-style
 * `categories`) to at most three curated genres (P02-07).
 *
 * Subjects are noisy — a science-fiction novel may also be tagged
 * "Children's fiction" — so every subject casts a vote and the genres with
 * the most support win. A subject naming several genres ("Science Fiction &
 * Fantasy") splits its vote. BISAC paths ("Fiction / Fantasy / Epic") count
 * double: they are curated categories, not free tags. Unknown subjects are
 * ignored, never turned into new genres.
 */

/** Subjects that say nothing about genre. Matched against the normalised subject. */
const NOISE: RegExp[] = [
  /^(?:nyt|award|series|place|person|time|subject)\s*:/,
  /^accessible book$/,
  /protected daisy/,
  /^in library$/,
  /lending library/,
  /^internet archive wishlist$/,
  /^overdrive$/,
  /^large (?:type|print) books?$/,
  /^open library staff picks$/,
  /^new york times (?:reviewed|bestseller)/,
  /bestseller/,
  /^reading level/,
  /^translations? (?:into|from|in|of) /,
  /language (?:books|materials|readers)$/,
  /^long now manual for civilization$/,
  /^cliffs ?notes$/,
  /^texts?$/,
  /^in english$/,
  /criticism and interpretation/,
  /history and criticism/,
  /\((?:imaginary|fictitious|fictional)[^)]*\)$/,
  /^general$/,
];

/** Longer than this is a detailed Library of Congress heading, not a genre. */
const MAX_SUBJECT_LENGTH = 60;

type Rule = [RegExp, CuratedGenre[]];

/**
 * Checked in order against one normalised segment; the first match wins. The
 * ambiguous topic words (history, travel, art, science, philosophy) only
 * count as a whole segment, so "History and criticism" or "Travel, fiction"
 * do not turn a novel into non-fiction.
 */
const RULES: Rule[] = [
  [/science fiction and fantasy|sf and fantasy|fantasy and science fiction/, ['Science Fiction', 'Fantasy']],
  [/^science fiction,? fantasy,? (?:and )?horror$/, ['Science Fiction', 'Fantasy', 'Horror']],
  [/science[ -]?fiction|sci[ -]?fi\b|ciencia ficcion|fantascienza|^sf$/, ['Science Fiction']],
  [/fantasy|fantastic fiction|fantastique|fantastica|merveilleux|sword and sorcery/, ['Fantasy']],
  [/detective|mystery|mysteries|crime fiction|^crime$|whodunit|policier|policiaca|cozy/, ['Mystery']],
  [/thriller|suspense|espionage|spy stories/, ['Thriller']],
  [/romance|love stories|^amours?$|romantic fiction|novela romantica/, ['Romance']],
  [/historical fiction|^historical(?: general)?$|^regency$|historical novel|novela historica|roman historique/, ['Historical Fiction']],
  [/horror|ghost stories|^occult/, ['Horror']],
  [/literary fiction|^literary$|magic(?:al)? realism|^classics?$|classic fiction|fiction classics|literature:? classics/, ['Literary Fiction']],
  [/young adult|^teen|^ya$|juvenile fiction young adult/, ['Young Adult']],
  [/juvenile|children|childrens|jeunesse|infantil|juvenil|picture books|kinderbuch|^toy and movable books$/, ["Children's"]],
  [/graphic novel|comic|manga|bandes? dessinee|historietas/, ['Graphic Novel']],
  [/poetry|poems|poesie|poesia|verse$/, ['Poetry']],
  [/autobiograph|memoir/, ['Memoir']],
  [/biograph/, ['Biography']],
  [/^cook|cookery|cookbooks?|recipes|gastronomy|^cuisine/, ['Cookery']],
  [/^self[ -]help|personal (?:growth|development)|^self improvement/, ['Self-Help']],
  [/^religion|christian|theology|^bible|spirituality|^islam|^buddhism|^judaism/, ['Religion']],
  [/^business|^economics|^management|^finance|^investing/, ['Business']],
  [/^reference$|dictionar|encyclopedi/, ['Reference']],
  [/^history$|^world history$|^military history$|^history (?:general|europe|modern|ancient)/, ['History']],
  [/^travel(?: general| guidebooks)?$|guidebooks?$|^voyages/, ['Travel']],
  [/^art$|^art history$|^painting$|^arts$|^photography$/, ['Art']],
  [/^philosophy$|^philosophie$|^filosofia$|^ethics$/, ['Philosophy']],
  [/^science$|^popular science$|^physics$|^biology$|^chemistry$|^astronomy$|^mathematics$|^nature$/, ['Science']],
  [/fiction|^novels?$|^novela$|^romans?$|^roman$|^ficcion$|^nouvelles$|^romans nouvelles/, ['Fiction']],
];

const GENERIC: ReadonlySet<CuratedGenre> = new Set<CuratedGenre>(['Fiction']);

function normalise(subject: string): string {
  return stripDiacritics(subject)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9:()/,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function genresOf(segment: string): CuratedGenre[] {
  const s = segment.replace(/\s*-\s*(?:general|series)$/, '').trim();
  if (!s || NOISE.some((re) => re.test(s))) return [];
  for (const [pattern, genres] of RULES) if (pattern.test(s)) return genres;
  return [];
}

/** One subject → the genres it names and the weight of its vote. */
function votes(raw: string): { genres: CuratedGenre[]; weight: number } {
  const s = normalise(raw);
  if (!s || s.length > MAX_SUBJECT_LENGTH || NOISE.some((re) => re.test(s))) return { genres: [], weight: 0 };

  // BISAC path: "Fiction / Fantasy / Epic", "Juvenile Fiction / Fantasy & Magic", or Open Library's
  // comma form of one: "Fiction, science fiction, general".
  const commaPath = /^(?:juvenile |young adult )?fiction,/.test(s);
  if (s.includes('/') || commaPath) {
    const parts = s.split(commaPath ? ',' : '/').map((p) => p.trim()).filter(Boolean);
    return { genres: unique(parts.flatMap((p) => genresOf(p))), weight: 2 };
  }

  // Library of Congress "Topic, fiction" (e.g. "Travel, fiction"): a novel about the topic.
  const topicFiction = /^(.+?),\s*(?:juvenile\s+)?fiction$/.exec(s);
  if (topicFiction && !genresOf(topicFiction[1]).some((g) => !nonFictionGenres.has(g) && !GENERIC.has(g))) {
    return { genres: s.includes('juvenile') ? ["Children's"] : ['Fiction'], weight: 1 };
  }

  // "Topic -- Juvenile fiction": the subdivisions after the topic carry the form.
  if (s.includes(' -- ')) {
    const [head, ...subdivisions] = s.split(' -- ');
    const fromSubdivisions = unique(subdivisions.flatMap((p) => genresOf(p)));
    return { genres: fromSubdivisions.length ? fromSubdivisions : genresOf(head), weight: 1 };
  }

  // "Fiction, fantasy, general", "Science fiction, fantasy, horror", "Romans, nouvelles".
  if (s.includes(',')) {
    const whole = genresOf(s);
    if (whole.length > 1) return { genres: whole, weight: 1 };
    const parts = unique(s.split(',').flatMap((p) => genresOf(p.trim())));
    return { genres: parts.length ? parts : whole, weight: 1 };
  }

  return { genres: genresOf(s), weight: 1 };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export interface GenreScore {
  genre: CuratedGenre;
  score: number;
}

/** Every genre the subjects support, with its score, strongest first. For tests and tuning. */
export function scoreGenres(subjects: readonly string[]): GenreScore[] {
  const scores = new Map<CuratedGenre, { score: number; first: number }>();
  const seen = new Set<string>();
  subjects.forEach((subject, index) => {
    const key = normalise(subject);
    if (seen.has(key)) return;
    seen.add(key);
    const { genres, weight } = votes(subject);
    if (!genres.length) return;
    // A subject naming several specific genres splits its vote among them. Fiction is a
    // weak, generic signal (often just the parent of a path), worth half and never a share.
    const specific = genres.filter((g) => !GENERIC.has(g));
    for (const genre of genres) {
      const entry = scores.get(genre) ?? { score: 0, first: index };
      entry.score += GENERIC.has(genre) ? weight / 2 : weight / specific.length;
      scores.set(genre, entry);
    }
  });
  // A book with plenty of fiction subjects is not History because one tag says so.
  const fictionEvidence = [...scores].filter(([g]) => !nonFictionGenres.has(g)).reduce((sum, [, e]) => sum + e.score, 0);
  if (fictionEvidence >= 2) {
    for (const [genre, entry] of scores) if (nonFictionGenres.has(genre)) entry.score /= 2;
  }
  return [...scores]
    .sort(([, a], [, b]) => b.score - a.score || a.first - b.first)
    .map(([genre, e]) => ({ genre, score: Math.round(e.score * 1000) / 1000 }));
}

export interface NormaliseGenresOptions {
  /** Most genres to return. Default 3. */
  max?: number;
  /**
   * A specific genre must score at least this fraction of the strongest
   * specific genre, which keeps stray tags out. Default 0.3.
   */
  minShare?: number;
}

/**
 * Curated genres for a book's subjects, most confident first: specific
 * genres (Fantasy, Mystery, …) by score, then Fiction when there is room.
 * At most three; unknown subjects are ignored.
 */
export function normaliseGenres(subjects: readonly string[], { max = 3, minShare = 0.3 }: NormaliseGenresOptions = {}): CuratedGenre[] {
  const scored = scoreGenres(subjects);
  const specific = scored.filter((s) => !GENERIC.has(s.genre));
  const top = specific[0]?.score ?? 0;
  const chosen = specific.filter((s) => s.score >= top * minShare && s.score >= 0.5).map((s) => s.genre);
  const generic = scored.filter((s) => GENERIC.has(s.genre) && s.score > 0).map((s) => s.genre);
  return [...chosen, ...generic].slice(0, max);
}
