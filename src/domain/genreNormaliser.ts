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
 *
 * Non-fiction is weighed against fiction: memoir, biography, history,
 * science, self-help, cookery and the like, plus plain signals ("Nonfiction",
 * "True crime", "Essays"), drop the generic "Fiction" when they are at least
 * twice as strong as the fiction genres, and a children's tag folded in from
 * a young readers' edition does not outvote them.
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
  // The Romance languages, not love stories.
  /^romance (?:literature|languages?|philology)\b/,
];

/** Share of the strongest genre that an audience or form genre (Children's, Graphic Novel, Poetry) needs to be kept. */
const AUDIENCE_SHARE = 0.6;

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
  // "Nonfiction" says what the book is not; it must never read as Fiction (the "/fiction/" rule below).
  [/^(?:adult )?non-?fiction$/, []],
  [/autobiographical (?:fiction|novels?)/, ['Literary Fiction']],
  [/biographical (?:fiction|novels?)/, ['Historical Fiction']],
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
  [
    /^science$|^popular science$|^physics$|^biology$|^chemistry$|^astronomy$|^mathematics$|^nature$|^computers?$|^computer (?:science|programming)$|^algorithms$|^programming$/,
    ['Science'],
  ],
  [/fiction|^novels?$|^novela$|^romans?$|^roman$|^ficcion$|^nouvelles$|^romans nouvelles/, ['Fiction']],
];

const GENERIC: ReadonlySet<CuratedGenre> = new Set<CuratedGenre>(['Fiction']);

/**
 * Who a book is for, or its form, rather than what it is: a work record
 * often gathers a young readers' edition ("Juvenile literature"), a comic
 * adaptation ("Comics & graphic novels, adaptations") or a stray form tag
 * ("Epic poems" on a novel), so these need more support than a subject
 * genre to be kept, and count as neither fiction nor non-fiction.
 */
const AUDIENCE: ReadonlySet<CuratedGenre> = new Set<CuratedGenre>(["Children's", 'Young Adult', 'Graphic Novel', 'Poetry']);

/** Subjects that say "not a novel" without naming a curated genre. Matched against the normalised subject. */
const NON_FICTION_SIGNALS: RegExp[] = [
  /(?:^|[ /,-])non-?fiction\b/,
  /^true crime\b|\btrue crime$/,
  /^essays?\b|\bessays$/,
  /^personal narratives?\b|\bpersonal narratives?$/,
  /^anecdotes$/,
  /^cookbooks?$/,
];

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

/** Whether a normalised subject says the book is non-fiction without naming a genre ("Nonfiction", "True crime"). */
function saysNonFiction(s: string): boolean {
  return NON_FICTION_SIGNALS.some((re) => re.test(s));
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
    const [head = [], ...rest] = parts.map((p) => genresOf(p));
    // Under a non-fiction heading ("Biography & Autobiography / Historical"), a later
    // segment names the topic, not a kind of novel.
    const nonFictionHead = head.length > 0 && head.every((g) => nonFictionGenres.has(g));
    const tail = rest.flat().filter((g) => !nonFictionHead || nonFictionGenres.has(g) || AUDIENCE.has(g));
    return { genres: unique([...head, ...tail]), weight: 2 };
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
  return score(subjects).genres;
}

/** The genre scores, and how strongly the subjects say "non-fiction" without naming a genre. */
function score(subjects: readonly string[]): { genres: GenreScore[]; nonFictionSignals: number } {
  const scores = new Map<CuratedGenre, { score: number; first: number }>();
  const seen = new Set<string>();
  let nonFictionSignals = 0;
  subjects.forEach((subject, index) => {
    const key = normalise(subject);
    if (seen.has(key)) return;
    seen.add(key);
    if (key.length <= MAX_SUBJECT_LENGTH && saysNonFiction(key)) nonFictionSignals += 1;
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
  const genres = [...scores]
    .sort(([, a], [, b]) => b.score - a.score || a.first - b.first)
    .map(([genre, e]) => ({ genre, score: Math.round(e.score * 1000) / 1000 }));
  return { genres, nonFictionSignals };
}

/**
 * How strongly the subjects say non-fiction (non-fiction genres plus signals
 * such as "Nonfiction", "True crime", "Essays") and fiction (the fiction
 * genres, "Fiction" included). Audience and form genres (`AUDIENCE`) are neither.
 */
function evidence(genres: readonly GenreScore[], nonFictionSignals: number): { nonFiction: number; fiction: number } {
  const nonFiction = genres.filter((g) => nonFictionGenres.has(g.genre)).reduce((sum, g) => sum + g.score, 0) + nonFictionSignals;
  const fiction = genres.filter((g) => !nonFictionGenres.has(g.genre) && !AUDIENCE.has(g.genre)).reduce((sum, g) => sum + g.score, 0);
  return { nonFiction, fiction };
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
  const { genres: scored, nonFictionSignals } = score(subjects);
  const { nonFiction, fiction } = evidence(scored, nonFictionSignals);
  // Non-fiction signals at least twice as strong as fiction ones: a memoir tagged "Nonfiction" and "Memoir" is not also "Fiction".
  const nonFictionBook = nonFiction > 0 && nonFiction >= 2 * fiction;
  const specific = scored.filter(
    // A work record that folds in a young readers' edition ("Obama, Michelle -- Juvenile literature")
    // is still an adult book when its adult non-fiction subjects outweigh the children's ones.
    (s) => !GENERIC.has(s.genre) && !(nonFictionBook && (s.genre === "Children's" || s.genre === 'Young Adult') && s.score < nonFiction),
  );
  const top = specific[0]?.score ?? 0;
  const fictionScore = scored.find((s) => GENERIC.has(s.genre))?.score ?? 0;
  // Audience and form need more support than a subject genre, measured against the strongest genre or,
  // when it is stronger, plain Fiction: two "pour la jeunesse" tags do not make "Cien años de soledad"
  // a children's book when a dozen subjects call it fiction.
  const enough = (s: GenreScore) =>
    AUDIENCE.has(s.genre) ? s.score >= Math.max(top, fictionScore) * Math.max(minShare, AUDIENCE_SHARE) : s.score >= top * minShare;
  const chosen = specific.filter((s) => enough(s) && s.score >= 0.5).map((s) => s.genre);
  const generic = nonFictionBook ? [] : scored.filter((s) => GENERIC.has(s.genre) && s.score > 0).map((s) => s.genre);
  return [...chosen, ...generic].slice(0, max);
}
