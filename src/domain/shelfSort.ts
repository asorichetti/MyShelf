import type { ShelfGroupBy } from './shelfView';

/**
 * The Shelf's multi-level sort (Phase 11): an ordered list of one to four
 * keys, each with its own direction, plus a seed for "Surprise me". The keys'
 * labels and SQL live in one registry, `src/db/sortKeys.ts`; this module is
 * the pure model (ids, presets, parsing old settings, saved presets).
 */
export const sortKeyIds = [
  'title',
  'author',
  'series',
  'seriesPosition',
  'genre',
  'year',
  'added',
  'updated',
  'pages',
  'publisher',
  'language',
  'format',
  'onLoan',
  'borrower',
  'group',
  'titleLength',
  'colour',
  'callNumber',
  'rating',
  'shuffle',
] as const;
export type SortKeyId = (typeof sortKeyIds)[number];
export type SortDirection = 'asc' | 'desc';

export interface SortLevel {
  key: SortKeyId;
  direction: SortDirection;
}

export interface ShelfSort {
  /** One to four levels, most significant first. Title, then id, always break what is left of a tie. */
  levels: SortLevel[];
  /** "Surprise me": the shuffle's seed, so the order stays put until the user shuffles again. */
  seed?: number;
}

export const MAX_SORT_LEVELS = 4;

/**
 * What the Sort sheet and the Shelf's summary need to know about a key. The
 * registry (`src/db/sortKeys.ts`) defines one per key, with its SQL.
 */
export interface SortKeyInfo {
  id: SortKeyId;
  /** "Author": the key's name in the sort sheet and the Shelf's summary. */
  label: string;
  /** One line saying exactly what is compared. */
  hint: string;
  defaultDirection: SortDirection;
  /** What each direction is called ("A to Z", "Newest first", "Shortest first"). */
  directionLabels: Record<SortDirection, string>;
  /** True when there is no direction to choose (the shuffle). */
  fixedDirection?: boolean;
}

export const defaultShelfSort: ShelfSort = { levels: [{ key: 'title', direction: 'asc' }] };

export function isSortKeyId(value: unknown): value is SortKeyId {
  return (sortKeyIds as readonly unknown[]).includes(value);
}

const isDirection = (value: unknown): value is SortDirection => value === 'asc' || value === 'desc';

/** Seeds stay below 2^30 so the shuffle's SQL arithmetic never leaves 64-bit integers. */
export const MAX_SEED = 2 ** 30;

export function newSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * (MAX_SEED - 1));
}

const isSeed = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0 && (value as number) < MAX_SEED;

/** Levels as stored: known keys and directions only, each key once, at most four. Null when nothing usable is left. */
export function parseSortLevels(value: unknown): SortLevel[] | null {
  if (!Array.isArray(value)) return null;
  const out: SortLevel[] = [];
  for (const level of value) {
    if (!level || typeof level !== 'object') continue;
    const { key, direction } = level as Record<string, unknown>;
    if (!isSortKeyId(key) || !isDirection(direction) || out.some((l) => l.key === key)) continue;
    out.push({ key, direction });
    if (out.length === MAX_SORT_LEVELS) break;
  }
  return out.length ? out : null;
}

/**
 * The stored sort, or null when it is unusable. Reads both shapes: today's
 * `{ levels, seed }` and the single key saved before Phase 11,
 * `{ sort: 'title' | 'author' | 'year' | 'added', direction }` (the Shelf's
 * sort menu and the Preferences screen both wrote it, and old backups carry
 * it), which becomes the same order as one level.
 */
export function parseShelfSort(value: unknown): ShelfSort | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if ('levels' in record) {
    const levels = parseSortLevels(record.levels);
    if (!levels) return null;
    const seed = isSeed(record.seed) ? record.seed : undefined;
    // A shuffle always needs a seed; one saved without it gets a fresh one.
    return withSeed({ levels }, seed);
  }
  return parseLegacySort(record);
}

/** Pre-Phase 11 keys (rating came with Phase 10), which kept their ids. */
const legacyKeys: readonly SortKeyId[] = ['title', 'author', 'year', 'added', 'rating'];

function parseLegacySort({ sort, direction }: Record<string, unknown>): ShelfSort | null {
  if (!(legacyKeys as readonly unknown[]).includes(sort) || !isDirection(direction)) return null;
  return { levels: [{ key: sort as SortKeyId, direction }] };
}

/** Whether a stored value is the pre-Phase 11 single-key shape (so it can be rewritten in the new one). */
export function isLegacySort(value: unknown): boolean {
  return !!value && typeof value === 'object' && !('levels' in value) && parseLegacySort(value as Record<string, unknown>) != null;
}

function withSeed(sort: ShelfSort, seed?: number): ShelfSort {
  const shuffles = sort.levels.some((l) => l.key === 'shuffle');
  if (!shuffles) return { levels: sort.levels };
  return { levels: sort.levels, seed: seed ?? newSeed() };
}

/** Same levels and directions (the seed is ignored). */
export function sameLevels(a: readonly SortLevel[], b: readonly SortLevel[]): boolean {
  return a.length === b.length && a.every((l, i) => l.key === b[i].key && l.direction === b[i].direction);
}

// ---- Presets ----

export const sortPresetIds = ['library', 'seriesOrder', 'callNumber', 'newest', 'titleAZ', 'byAuthor', 'rainbow', 'surprise'] as const;
export type SortPresetId = (typeof sortPresetIds)[number];

export interface SortPreset {
  id: SortPresetId;
  name: string;
  levels: SortLevel[];
}

const asc = (key: SortKeyId): SortLevel => ({ key, direction: 'asc' });

/**
 * The built-in presets. Title is every sort's last tiebreaker, so "Library
 * order" (genre, author, series, number in series, title) fits in four levels.
 */
export const sortPresets: readonly SortPreset[] = [
  { id: 'library', name: 'Library order', levels: [asc('genre'), asc('author'), asc('series'), asc('seriesPosition')] },
  { id: 'seriesOrder', name: 'Series reading order', levels: [asc('series'), asc('seriesPosition')] },
  { id: 'callNumber', name: 'Call number', levels: [asc('callNumber')] },
  { id: 'newest', name: 'Newest additions', levels: [{ key: 'added', direction: 'desc' }] },
  { id: 'titleAZ', name: 'A–Z by title', levels: [asc('title')] },
  { id: 'byAuthor', name: 'By author', levels: [asc('author'), asc('series'), asc('seriesPosition'), asc('year')] },
  { id: 'rainbow', name: 'Rainbow', levels: [asc('colour')] },
  { id: 'surprise', name: 'Surprise me', levels: [asc('shuffle')] },
];

export function sortPreset(id: SortPresetId): SortPreset {
  return sortPresets.find((p) => p.id === id)!;
}

/** The sort a preset gives: "Surprise me" deals a new shuffle each time it is chosen. */
export function applyPreset(levels: readonly SortLevel[], random: () => number = Math.random): ShelfSort {
  return withSeed({ levels: levels.map((l) => ({ ...l })) }, levels.some((l) => l.key === 'shuffle') ? newSeed(random) : undefined);
}

// ---- Saved presets ----

/** A preset the user named and saved. */
export interface SavedSortPreset {
  id: string;
  name: string;
  levels: SortLevel[];
}

export const MAX_PRESET_NAME = 40;
export const MAX_SAVED_PRESETS = 20;

export function parseSavedPresets(value: unknown): SavedSortPreset[] {
  if (!Array.isArray(value)) return [];
  const out: SavedSortPreset[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { id, name, levels } = item as Record<string, unknown>;
    const parsed = parseSortLevels(levels);
    if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim() || !parsed) continue;
    if (out.some((p) => p.id === id)) continue;
    out.push({ id, name: name.trim().slice(0, MAX_PRESET_NAME), levels: parsed });
  }
  return out.slice(0, MAX_SAVED_PRESETS);
}

export type PresetNameProblem = 'empty' | 'tooLong' | 'taken' | 'full';

/** Why a name cannot be used for a saved preset (null when it can). `exceptId` is the preset being renamed. */
export function presetNameProblem(name: string, saved: readonly SavedSortPreset[], exceptId?: string): PresetNameProblem | null {
  const n = name.trim();
  if (!n) return 'empty';
  if (n.length > MAX_PRESET_NAME) return 'tooLong';
  const lower = n.toLocaleLowerCase();
  const taken = saved.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase() === lower) || sortPresets.some((p) => p.name.toLocaleLowerCase() === lower);
  if (taken) return 'taken';
  if (exceptId == null && saved.length >= MAX_SAVED_PRESETS) return 'full';
  return null;
}

/** Adds a preset; throws when the name cannot be used (check `presetNameProblem` first). */
export function addSavedPreset(saved: readonly SavedSortPreset[], name: string, levels: readonly SortLevel[], id: string): SavedSortPreset[] {
  const problem = presetNameProblem(name, saved);
  if (problem) throw new Error(`Cannot save the preset: ${problem}`);
  return [...saved, { id, name: name.trim(), levels: levels.map((l) => ({ ...l })) }];
}

export function renameSavedPreset(saved: readonly SavedSortPreset[], id: string, name: string): SavedSortPreset[] {
  const problem = presetNameProblem(name, saved, id);
  if (problem) throw new Error(`Cannot rename the preset: ${problem}`);
  return saved.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
}

export function deleteSavedPreset(saved: readonly SavedSortPreset[], id: string): SavedSortPreset[] {
  return saved.filter((p) => p.id !== id);
}

/** A new saved preset's id: unique among `saved`. */
export function newPresetId(saved: readonly SavedSortPreset[], now: number = Date.now()): string {
  let n = now;
  while (saved.some((p) => p.id === `p${n.toString(36)}`)) n++;
  return `p${n.toString(36)}`;
}

/** The built-in or saved preset whose levels these are, if any. */
export function matchingPreset(levels: readonly SortLevel[], saved: readonly SavedSortPreset[] = []): SortPreset | SavedSortPreset | null {
  return sortPresets.find((p) => sameLevels(p.levels, levels)) ?? saved.find((p) => sameLevels(p.levels, levels)) ?? null;
}

// ---- Levels and the rows editor ----

export function moveLevel(levels: readonly SortLevel[], index: number, by: -1 | 1): SortLevel[] {
  const to = index + by;
  if (index < 0 || index >= levels.length || to < 0 || to >= levels.length) return [...levels];
  const out = [...levels];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

export function removeLevel(levels: readonly SortLevel[], index: number): SortLevel[] {
  if (levels.length <= 1) return [...levels];
  return levels.filter((_, i) => i !== index);
}

export function flipLevel(levels: readonly SortLevel[], index: number): SortLevel[] {
  return levels.map((l, i) => (i === index ? { ...l, direction: l.direction === 'asc' ? 'desc' : 'asc' } : l));
}

// ---- Grouping ----

/** The sort key that means the same as each grouping: sorting by it inside its own sections would do nothing. */
export const groupSortKey: Record<ShelfGroupBy, SortKeyId | null> = {
  none: null,
  genre: 'genre',
  series: 'series',
  author: 'author',
  group: 'group',
  rating: 'rating',
};

/** Which way each grouping's sections run on their own: A to Z, except ratings, best first. */
export const groupSectionDirection: Record<ShelfGroupBy, SortDirection> = {
  none: 'asc',
  genre: 'asc',
  series: 'asc',
  author: 'asc',
  group: 'asc',
  rating: 'desc',
};

export interface SectionSort {
  /** The levels applied inside each section. */
  levels: SortLevel[];
  /** The first level, when it was the grouping's own key and so is shown as the sections' order instead. */
  skipped: SortLevel | null;
  /** The skipped level runs against the grouping's own direction: show the sections the other way round. */
  reverseSections: boolean;
}

/**
 * The order inside each section of a grouped Shelf: sections come in the
 * grouping's order, and the sort applies within them. A first level that is
 * the grouping's own key (genre inside genre sections) is dropped there; its
 * direction orders the sections instead (genre Z to A reverses them; rating
 * sections run best first on their own, so lowest first reverses those). When it was the only level, title
 * order is what is left.
 */
export function sectionSort(levels: readonly SortLevel[], groupBy: ShelfGroupBy): SectionSort {
  const key = groupSortKey[groupBy];
  if (key && levels[0]?.key === key) {
    const rest = levels.slice(1);
    return { levels: rest.length ? rest : [{ key: 'title', direction: 'asc' }], skipped: levels[0], reverseSections: levels[0].direction !== groupSectionDirection[groupBy] };
  }
  return { levels: [...levels], skipped: null, reverseSections: false };
}

// ---- Surprise me ----

const MASK = 0xffffffffn;

/**
 * The shuffle's rank for a book: the id stepped by the golden ratio plus the
 * seed, then one xor-shift-multiply round, all in 32 bits. The SQL in the
 * registry computes exactly this; this twin is for tests.
 */
export function shuffleRank(id: number, seed: number): number {
  const x = (BigInt(id) * 2654435761n + BigInt(seed)) & MASK;
  return Number((((x >> 16n) ^ x) * 73244475n) & MASK);
}
