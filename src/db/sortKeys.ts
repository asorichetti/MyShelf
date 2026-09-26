import {
  callNumber,
  defaultShelfSort,
  hashColour,
  languages,
  sortKeyIds,
  type ShelfSort,
  type SortDirection,
  type SortKeyId,
  type SortKeyInfo,
} from '@/domain';

import type { Db, SqlValue } from './types';

/**
 * The sort key registry (P11-01): every key the Shelf can sort by, in one
 * place — its label, its natural direction and what each direction is called
 * (catalogue keys in `src/i18n/en.ts` under `sort.`, translated when shown),
 * the SQL value it orders by, and the joins that SQL reads. The Shelf query
 * (`listBookItems`) builds its ORDER BY from here and nowhere else.
 *
 * Every key sorts books whose value is unknown (no author, no series, never
 * lent...) after the rest, whichever way round it runs. Text keys ignore case
 * and accents ("Émile" files under E); titles also ignore a leading The, A
 * or An. Title, then id, break whatever tie is left, so the order is always
 * the same for the same library.
 *
 * Two keys are worked out in TypeScript, because they are what the app
 * draws rather than what the database stores: the call number (the same
 * `callNumber()` the book page prints) and the spine colour (the generated
 * binding `hashColour()` picks, placed round the colour wheel by the order
 * the caller passes from the theme, `SortOptions.coverOrder`). Each is
 * computed for the whole library just before the query and handed to it as
 * one BLOB of three-byte ranks indexed by book id, which SQLite reads in
 * constant time with `substr`.
 */

/** A join the base Shelf query may need to have for a key's SQL. */
export type SortJoin = 'series' | 'openLoan';

/** The SQL each join adds (aliases `s`, `ol`, `olp` are what the keys refer to). */
export const SORT_JOINS: Record<SortJoin, string> = {
  series: 'LEFT JOIN series s ON s.id = b.series_id',
  openLoan: 'LEFT JOIN loans ol ON ol.book_id = b.id AND ol.returned_on IS NULL LEFT JOIN borrowers olp ON olp.id = ol.borrower_id',
};

export interface SortKeyDef extends SortKeyInfo {
  /** Joins the SQL reads, beyond `books b`. */
  joins: readonly SortJoin[];
  /**
   * The ORDER BY term(s) for one direction. NULL means "unknown" and must go
   * last either way; `orderTerm` arranges that, so `value` just returns the
   * value (or NULL).
   */
  value: (ctx: TermContext) => string;
  /** Text: compared ignoring case (values are already accent-folded). */
  text?: boolean;
  /** A never-null value that breaks this key's own ties in the same direction (books added in the same millisecond: by id). */
  then?: string;
  /** Computed in TypeScript for the whole library before the query: book id -> rank. */
  rank?: (db: Db, options: SortOptions) => Promise<Map<number, number>>;
}

/** What the query needs from outside the database. */
export interface SortOptions {
  /**
   * "Spine colour": the place of each generated binding round the colour
   * wheel, index by index (`rainbowRanks(theme.covers)` in src/theme), so
   * the order follows the colours on screen. Its length is the number of
   * bindings `hashColour` picks from. Without it, bindings keep palette order.
   */
  coverOrder?: readonly number[];
}

/** The eight generated bindings in palette order, for callers with no theme (tests, scripts). */
const PALETTE_ORDER: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

export interface TermContext {
  /** "Surprise me": the sort's seed. */
  seed: number;
  /** Binds a value for the term and returns its placeholder. */
  bind: (value: SqlValue) => string;
  /** For a `rank` key: the ranks it computed. */
  ranks?: Map<number, number>;
}

// ---- Folding: case and accents ----

/** Letters folded to plain Latin for sorting: the common accented letters of European languages. */
const FOLDS: readonly [string, string][] = [
  ...pairs('àáâãäåāăą', 'a'), ...pairs('ÀÁÂÃÄÅĀĂĄ', 'a'), ...pairs('çćč', 'c'), ...pairs('ÇĆČ', 'c'), ...pairs('ďđ', 'd'), ...pairs('ĎĐ', 'd'),
  ...pairs('èéêëēėęě', 'e'), ...pairs('ÈÉÊËĒĖĘĚ', 'e'), ...pairs('ğ', 'g'), ...pairs('Ğ', 'g'), ...pairs('ìíîïīįı', 'i'), ...pairs('ÌÍÎÏĪĮİ', 'i'),
  ...pairs('łľ', 'l'), ...pairs('ŁĽ', 'l'), ...pairs('ñńň', 'n'), ...pairs('ÑŃŇ', 'n'), ...pairs('òóôõöøōő', 'o'), ...pairs('ÒÓÔÕÖØŌŐ', 'o'),
  ...pairs('řŕ', 'r'), ...pairs('ŘŔ', 'r'), ...pairs('śšşș', 's'), ...pairs('ŚŠŞȘ', 's'), ...pairs('ťţț', 't'), ...pairs('ŤŢȚ', 't'),
  ...pairs('ùúûüūůűų', 'u'), ...pairs('ÙÚÛÜŪŮŰŲ', 'u'), ...pairs('ýÿ', 'y'), ...pairs('ÝŸ', 'y'), ...pairs('źżž', 'z'), ...pairs('ŹŻŽ', 'z'),
  ['ß', 'ss'], ['æ', 'ae'], ['Æ', 'ae'], ['œ', 'oe'], ['Œ', 'oe'], ['þ', 'th'], ['Þ', 'th'], ['ð', 'd'], ['Ð', 'd'],
];

function pairs(letters: string, to: string): [string, string][] {
  return [...letters].map((c) => [c, to]);
}

/** The folds as a list (for tests). */
export const foldedLetters: readonly (readonly [string, string])[] = FOLDS;

/**
 * `expr` with accents folded, for sorting. SQLite's own NOCASE folds only
 * ASCII, so accented letters are replaced first — but only in values that
 * have any non-ASCII character (the GLOB), which in most libraries is a few
 * titles in a hundred, so plain ASCII values cost one GLOB each.
 */
export function foldSql(expr: string): string {
  let out = expr;
  for (const [from, to] of FOLDS) out = `replace(${out}, '${from}', '${to}')`;
  return `CASE WHEN ${expr} GLOB '*[^ -~]*' THEN ${out} ELSE ${expr} END`;
}

/** SQL twin of `sortableTitle()` in src/domain/book.ts: a leading The/A/An is ignored. */
export const SORT_TITLE_SQL = `CASE
  WHEN b.title LIKE 'the %' THEN ltrim(substr(b.title, 5))
  WHEN b.title LIKE 'a %' THEN ltrim(substr(b.title, 3))
  WHEN b.title LIKE 'an %' THEN ltrim(substr(b.title, 4))
  ELSE b.title END`;

const TITLE_KEY = foldSql(`(${SORT_TITLE_SQL})`);

/** The first credited author's sort name ("Pratchett, Terry"), folded. */
const FIRST_AUTHOR = `(SELECT ${foldSql('COALESCE(a.sort_name, a.name)')} FROM book_authors ba JOIN authors a ON a.id = ba.author_id
  WHERE ba.book_id = b.id ORDER BY ba.position, a.id LIMIT 1)`;

/**
 * A book's primary genre: the first of its genres in alphabetical order
 * (ignoring case) — the order the book page lists them in, so it is also the
 * genre its call number's class comes from. Books have no "main" genre of
 * their own; alphabetical is stable and needs nothing new stored.
 */
const PRIMARY_GENRE = `(SELECT ${foldSql('g.name')} FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
  WHERE bg.book_id = b.id ORDER BY g.name COLLATE NOCASE, g.id LIMIT 1)`;

/** The first of the user groups the book is in, alphabetically. */
const FIRST_GROUP = `(SELECT ${foldSql('g.name')} FROM group_books gb JOIN groups g ON g.id = gb.group_id
  WHERE gb.book_id = b.id ORDER BY g.name COLLATE NOCASE, g.id LIMIT 1)`;

/** Blank text is as unknown as no text. */
const textOrNull = (col: string) => foldSql(`NULLIF(trim(${col}), '')`);

const q = (text: string) => `'${text.replace(/'/g, "''")}'`;

/** Language codes by English name ("de" -> "German"); a code the app does not know sorts by itself, in capitals. */
const LANGUAGE_NAME = `CASE b.language ${languages.map((l) => `WHEN ${q(l.code)} THEN ${q(l.name)}`).join(' ')} ELSE upper(b.language) END`;

const FORMAT_ORDER = `CASE b.format WHEN 'hardcover' THEN 1 WHEN 'paperback' THEN 2 WHEN 'ebook' THEN 3 WHEN 'audiobook' THEN 4 END`;

// ---- Surprise me ----

/**
 * SQL twin of `shuffleRank()` in src/domain/shelfSort.ts: the id stepped by
 * the golden ratio plus the seed, then one xor-shift-multiply round (SQLite
 * has no XOR, so `a ^ b` is written `(a | b) - (a & b)`). One round keeps
 * the expression small enough to cost little more than sorting by id.
 * `seed` is a validated integer, inlined.
 */
export function shuffleSql(seed: number): string {
  if (!Number.isInteger(seed) || seed < 0) throw new RangeError(`Bad shuffle seed ${seed}`);
  const x = `((b.id * 2654435761 + ${seed}) & 4294967295)`;
  return `((((${x} >> 16) | ${x}) - ((${x} >> 16) & ${x})) * 73244475 & 4294967295)`;
}

// ---- Computed ranks ----

/** Three bytes per book id: ranks up to 16.7 million. */
const RANK_BYTES = 3;

/** Packs id -> rank into the BLOB the SQL reads with `substr`; ids with no rank read as zero bytes. */
export function packRanks(ranks: Map<number, number>): Uint8Array {
  let maxId = 0;
  for (const id of ranks.keys()) maxId = Math.max(maxId, id);
  const out = new Uint8Array(maxId * RANK_BYTES);
  for (const [id, rank] of ranks) {
    const at = (id - 1) * RANK_BYTES;
    out[at] = (rank >> 16) & 255;
    out[at + 1] = (rank >> 8) & 255;
    out[at + 2] = rank & 255;
  }
  return out;
}

/** The rank term: a book added after the ranks were worked out has none (NULL) and so goes last. */
function rankTerm(ctx: TermContext): string {
  const ranks = ctx.ranks ?? new Map<number, number>();
  const blob = packRanks(ranks);
  const maxId = blob.length / RANK_BYTES;
  return `CASE WHEN b.id <= ${maxId} THEN substr(${ctx.bind(blob)}, (b.id - 1) * ${RANK_BYTES} + 1, ${RANK_BYTES}) END`;
}

/** Dense ranks for values sorted by `compare`: equal values share a rank. */
function denseRanks<T>(entries: [number, T][], compare: (a: T, b: T) => number): Map<number, number> {
  const sorted = [...entries].sort((a, b) => compare(a[1], b[1]));
  const out = new Map<number, number>();
  let rank = 0;
  sorted.forEach(([id, value], i) => {
    if (i > 0 && compare(sorted[i - 1][1], value) !== 0) rank++;
    out.set(id, rank);
  });
  return out;
}

/** Title -> generated binding (per palette size): a title's colour never changes, so it is worked out once. */
const bindingByTitle = new Map<string, number>();
const MAX_REMEMBERED_TITLES = 50_000;

/** Each book's spine colour, as its place round the colour wheel (0 = red). */
async function colourRanks(db: Db, { coverOrder = PALETTE_ORDER }: SortOptions): Promise<Map<number, number>> {
  const count = coverOrder.length;
  const rows = await db.all<{ id: number; title: string }>('SELECT id, title FROM books');
  if (bindingByTitle.size > MAX_REMEMBERED_TITLES) bindingByTitle.clear();
  const out = new Map<number, number>();
  for (const { id, title } of rows) {
    const key = `${count}\u0000${title}`;
    let binding = bindingByTitle.get(key);
    if (binding === undefined) {
      binding = hashColour(title, count);
      bindingByTitle.set(key, binding);
    }
    out.set(id, coverOrder[binding]);
  }
  return out;
}

/** Call number parts: class, author mark, year (none last). */
type CallParts = [string, string, number];
const compareCall = (a: CallParts, b: CallParts) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2]);

/** Each book's call number ("FIC PRA 1983"), exactly as the book page prints it, in shelf order. */
async function callNumberRanks(db: Db): Promise<Map<number, number>> {
  const rows = await db.all<{ id: number; title: string; year: number | null; genre: string | null; author: string | null }>(
    `SELECT b.id, b.title, b.publication_year AS year,
       (SELECT g.name FROM book_genres bg JOIN genres g ON g.id = bg.genre_id WHERE bg.book_id = b.id ORDER BY g.name, g.id LIMIT 1) AS genre,
       (SELECT COALESCE(a.sort_name, a.name) FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id ORDER BY ba.position, a.id LIMIT 1) AS author
     FROM books b`,
  );
  // Books by the same author in the same genre and year share a call number: work each one out once.
  const seen = new Map<string, CallParts>();
  const parts = rows.map((r): [number, CallParts] => {
    const key = `${r.genre ?? ''}\u0000${r.author != null ? `a${r.author}` : `t${r.title}`}\u0000${r.year ?? ''}`;
    let call = seen.get(key);
    if (!call) {
      const [cls, mark, year] = callNumber({ genres: r.genre ? [r.genre] : [], author: r.author, title: r.title, year: r.year }).split(' ');
      call = [cls, mark, year ? Number(year) : Number.MAX_SAFE_INTEGER];
      seen.set(key, call);
    }
    return [r.id, call];
  });
  return denseRanks(parts, compareCall);
}

// ---- The registry ----

const AZ = { asc: 'sort.direction.aToZ', desc: 'sort.direction.zToA' } as const;

type Defs = { [K in SortKeyId]: Omit<SortKeyDef, 'id'> };

const defs: Defs = {
  title: {
    label: 'sort.keys.title.label',
    hint: 'sort.keys.title.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: [],
    text: true,
    value: () => TITLE_KEY,
  },
  author: {
    label: 'sort.keys.author.label',
    hint: 'sort.keys.author.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: [],
    text: true,
    value: () => FIRST_AUTHOR,
  },
  series: {
    label: 'sort.keys.series.label',
    hint: 'sort.keys.series.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: ['series'],
    text: true,
    value: () => foldSql('s.name'),
  },
  seriesPosition: {
    label: 'sort.keys.seriesPosition.label',
    hint: 'sort.keys.seriesPosition.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.firstToLast', desc: 'sort.direction.lastToFirst' },
    joins: [],
    value: () => 'b.series_position',
  },
  genre: {
    label: 'sort.keys.genre.label',
    hint: 'sort.keys.genre.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: [],
    text: true,
    value: () => PRIMARY_GENRE,
  },
  year: {
    label: 'sort.keys.year.label',
    hint: 'sort.keys.year.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.oldestFirst', desc: 'sort.direction.newestFirst' },
    joins: [],
    value: () => 'b.publication_year',
  },
  added: {
    label: 'sort.keys.added.label',
    hint: 'sort.keys.added.hint',
    defaultDirection: 'desc',
    directionLabels: { asc: 'sort.direction.oldestFirst', desc: 'sort.direction.newestFirst' },
    joins: [],
    value: () => 'b.created_at',
    then: 'b.id',
  },
  updated: {
    label: 'sort.keys.updated.label',
    hint: 'sort.keys.updated.hint',
    defaultDirection: 'desc',
    directionLabels: { asc: 'sort.direction.longestAgoFirst', desc: 'sort.direction.mostRecentFirst' },
    joins: [],
    value: () => 'b.updated_at',
  },
  pages: {
    label: 'sort.keys.pages.label',
    hint: 'sort.keys.pages.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.shortestFirst', desc: 'sort.direction.longestFirst' },
    joins: [],
    value: () => 'b.page_count',
  },
  publisher: {
    label: 'sort.keys.publisher.label',
    hint: 'sort.keys.publisher.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: [],
    text: true,
    value: () => textOrNull('b.publisher'),
  },
  language: {
    label: 'sort.keys.language.label',
    hint: 'sort.keys.language.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: [],
    text: true,
    value: () => foldSql(`(${LANGUAGE_NAME})`),
  },
  format: {
    label: 'sort.keys.format.label',
    hint: 'sort.keys.format.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.hardbackFirst', desc: 'sort.direction.audiobookFirst' },
    joins: [],
    value: () => FORMAT_ORDER,
  },
  onLoan: {
    label: 'sort.keys.onLoan.label',
    hint: 'sort.keys.onLoan.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.onLoanFirst', desc: 'sort.direction.atHomeFirst' },
    joins: ['openLoan'],
    value: () => '(ol.id IS NULL)',
  },
  borrower: {
    label: 'sort.keys.borrower.label',
    hint: 'sort.keys.borrower.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: ['openLoan'],
    text: true,
    value: () => foldSql('olp.name'),
  },
  group: {
    label: 'sort.keys.group.label',
    hint: 'sort.keys.group.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: [],
    text: true,
    value: () => FIRST_GROUP,
  },
  titleLength: {
    label: 'sort.keys.titleLength.label',
    hint: 'sort.keys.titleLength.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.shortestFirst', desc: 'sort.direction.longestFirst' },
    joins: [],
    value: () => 'length(b.title)',
  },
  colour: {
    label: 'sort.keys.colour.label',
    hint: 'sort.keys.colour.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.redToViolet', desc: 'sort.direction.violetToRed' },
    joins: [],
    rank: colourRanks,
    value: rankTerm,
  },
  callNumber: {
    label: 'sort.keys.callNumber.label',
    hint: 'sort.keys.callNumber.hint',
    defaultDirection: 'asc',
    directionLabels: AZ,
    joins: [],
    rank: callNumberRanks,
    value: rankTerm,
  },
  rating: {
    label: 'sort.keys.rating.label',
    hint: 'sort.keys.rating.hint',
    defaultDirection: 'desc',
    directionLabels: { asc: 'sort.direction.lowestFirst', desc: 'sort.direction.highestFirst' },
    joins: [],
    value: () => 'b.rating',
  },
  shuffle: {
    label: 'sort.keys.shuffle.label',
    hint: 'sort.keys.shuffle.hint',
    defaultDirection: 'asc',
    directionLabels: { asc: 'sort.direction.shuffled', desc: 'sort.direction.shuffled' },
    fixedDirection: true,
    joins: [],
    value: (ctx) => shuffleSql(ctx.seed),
  },
};

/** Every key, in the order the sort sheet offers them. */
export const sortKeyRegistry: Readonly<Record<SortKeyId, SortKeyDef>> = Object.fromEntries(
  sortKeyIds.map((id) => [id, { id, ...defs[id] }]),
) as Record<SortKeyId, SortKeyDef>;

export const sortKeyList: readonly SortKeyDef[] = sortKeyIds.map((id) => sortKeyRegistry[id]);

export function sortKeyDef(id: SortKeyId): SortKeyDef {
  return sortKeyRegistry[id];
}

// ---- ORDER BY ----

/**
 * One level's ORDER BY term. Unknown values last in both directions without
 * evaluating the value twice (a correlated subquery would run twice):
 * ascending, a NULL becomes a BLOB, which SQLite sorts after every number
 * and every text — and, being four 0xFF bytes, after every three-byte rank
 * BLOB too; descending, NULL already sorts last.
 */
const LAST = "x'FFFFFFFF'";

export function orderTerm(def: SortKeyDef, direction: SortDirection, ctx: TermContext): string {
  const value = def.value(ctx);
  const dir = def.fixedDirection ? 'ASC' : direction === 'desc' ? 'DESC' : 'ASC';
  const collate = def.text ? ' COLLATE NOCASE' : '';
  const then = def.then ? `, ${def.then} ${dir}` : '';
  if (dir === 'DESC') return `(${value})${collate} DESC${then}`;
  return `COALESCE(${value}, ${LAST})${collate} ASC${then}`;
}

export interface SortSql {
  /** The ORDER BY list (without the keyword). */
  orderBy: string;
  /** Parameters the ORDER BY binds, in order: append them after the query's WHERE parameters. */
  params: SqlValue[];
  /** Joins the keys read. */
  joins: SortJoin[];
}

/**
 * The ORDER BY for a sort: its levels, then title, then id. Keys worked out
 * in TypeScript (call number, spine colour) are computed first, for the
 * whole library.
 */
export async function buildSortSql(db: Db, sort: ShelfSort = defaultShelfSort, options: SortOptions = {}): Promise<SortSql> {
  const params: SqlValue[] = [];
  const joins = new Set<SortJoin>();
  const terms: string[] = [];
  const seed = sort.seed ?? 1;
  for (const level of sort.levels) {
    const def = sortKeyRegistry[level.key];
    if (!def) continue;
    def.joins.forEach((j) => joins.add(j));
    const ranks = def.rank ? await def.rank(db, options) : undefined;
    const bind = (v: SqlValue) => {
      params.push(v);
      return '?';
    };
    terms.push(orderTerm(def, level.direction, { seed, bind, ranks }));
  }
  if (!sort.levels.some((l) => l.key === 'title')) terms.push(`${TITLE_KEY} COLLATE NOCASE ASC`);
  terms.push('b.id ASC');
  return { orderBy: terms.join(',\n  '), params, joins: [...joins] };
}
