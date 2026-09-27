import { settingDefaults, type AppSettings, type SettingKey } from '@/domain';

import type { Db } from '../types';

const kind = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/**
 * Whether a parsed value has the shape its setting holds: the type of its
 * default (a list, an object, a number…), or for settings whose default is
 * null ("never answered", "never backed up") null or their one other type.
 * Stored values come from backups too, which people can edit.
 */
function fits(key: SettingKey, value: unknown): boolean {
  const fallback: unknown = settingDefaults[key];
  if (fallback !== null) return kind(value) === kind(fallback);
  return value === null || typeof value === (key === 'onboarding.done' ? 'boolean' : 'string');
}

function decode<K extends SettingKey>(key: K, raw: string | null | undefined): AppSettings[K] {
  if (raw == null) return settingDefaults[key];
  try {
    const value: unknown = JSON.parse(raw);
    return fits(key, value) ? (value as AppSettings[K]) : settingDefaults[key];
  } catch {
    return settingDefaults[key];
  }
}

// ---- Settings that name genres and series ----
//
// Genre and series ids can be given again after a delete (SQLite's next id is
// the highest plus one), so a setting that kept a deleted one would silently
// apply to whatever took its id next. Deleting or merging forgets the id
// (`forgetEntities`), and reading drops ids that no longer exist (`dropUnknown`,
// for settings saved before, or restored). Groups and authors are named by no
// setting.

/** Entities that settings name by id. */
export type EntityKind = 'genre' | 'series';

/** Booky's tips remembered per series in `booky.seen`: `series-gap:<id>`, optionally `@<date>`. */
const SERIES_SEEN = /^series-(?:gap|complete):(\d+)(?:@|$)/;
const seriesOfSeen = (entry: unknown): number | null => {
  const m = typeof entry === 'string' ? SERIES_SEEN.exec(entry) : null;
  return m ? Number(m[1]) : null;
};

async function existingIds(db: Db, table: 'genres' | 'series', ids: readonly number[]): Promise<Set<number>> {
  const wanted = [...new Set(ids)].filter((id) => Number.isSafeInteger(id));
  if (!wanted.length) return new Set();
  const rows = await db.all<{ id: number }>(`SELECT id FROM ${table} WHERE id IN (${wanted.map(() => '?').join(', ')})`, wanted);
  return new Set(rows.map((r) => r.id));
}

/** `value` without ids of genres or series that no longer exist. */
async function dropUnknown<K extends SettingKey>(db: Db, key: K, value: AppSettings[K]): Promise<AppSettings[K]> {
  if (key === 'shelfFilters') {
    const filters = value as AppSettings['shelfFilters'];
    const ids = Array.isArray(filters.genreIds) ? filters.genreIds : [];
    if (!ids.length) return value;
    const known = await existingIds(db, 'genres', ids);
    return (ids.every((id) => known.has(id)) ? value : { ...filters, genreIds: ids.filter((id) => known.has(id)) }) as AppSettings[K];
  }
  if (key === 'booky.seen') {
    const seen = value as AppSettings['booky.seen'];
    const ids = seen.map(seriesOfSeen).filter((id): id is number => id != null);
    if (!ids.length) return value;
    const known = await existingIds(db, 'series', ids);
    return seen.filter((entry) => {
      const id = seriesOfSeen(entry);
      return id == null || known.has(id);
    }) as AppSettings[K];
  }
  return value;
}

/**
 * Removes deleted genres or series from the settings that name them: the
 * Shelf's genre filter (a merged genre is replaced by the genre it went
 * into, `mergedInto`) and Booky's per-series tips. Call in the deletion's
 * transaction.
 */
export async function forgetEntities(db: Db, kind: EntityKind, ids: readonly number[], { mergedInto }: { mergedInto?: number } = {}): Promise<void> {
  const gone = new Set(ids);
  if (!gone.size) return;
  // As stored: reading would already leave the deleted ids out.
  const stored = async <K extends SettingKey>(key: K) => decode(key, (await db.get<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]))?.value);
  if (kind === 'genre') {
    const filters = await stored('shelfFilters');
    if (!Array.isArray(filters.genreIds) || !filters.genreIds.some((id) => gone.has(id))) return;
    const genreIds = [...new Set(filters.genreIds.flatMap((id) => (!gone.has(id) ? [id] : mergedInto != null ? [mergedInto] : [])))];
    await setSetting(db, 'shelfFilters', { ...filters, genreIds });
    return;
  }
  const seen = await stored('booky.seen');
  const kept = seen.filter((entry) => {
    const id = seriesOfSeen(entry);
    return id == null || !gone.has(id);
  });
  if (kept.length !== seen.length) await setSetting(db, 'booky.seen', kept);
}

/**
 * A setting's value, or its default when unset, unreadable or of the wrong
 * type. Genres and series it names that no longer exist are left out.
 */
export async function getSetting<K extends SettingKey>(db: Db, key: K): Promise<AppSettings[K]> {
  const row = await db.get<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
  return dropUnknown(db, key, decode(key, row?.value));
}

export async function setSetting<K extends SettingKey>(db: Db, key: K, value: AppSettings[K]): Promise<void> {
  await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
    key,
    JSON.stringify(value),
  ]);
}

/** Forgets a setting so it falls back to its default. */
export async function resetSetting(db: Db, key: SettingKey): Promise<boolean> {
  return (await db.run('DELETE FROM settings WHERE key = ?', [key])).changes > 0;
}

/** Every known setting, with defaults filled in. Unknown stored keys are ignored. */
export async function getAllSettings(db: Db): Promise<AppSettings> {
  const rows = await db.all<{ key: string; value: string | null }>('SELECT key, value FROM settings');
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...settingDefaults } as AppSettings;
  for (const key of Object.keys(settingDefaults) as SettingKey[]) {
    if (stored.has(key)) (out as unknown as Record<string, unknown>)[key] = await dropUnknown(db, key, decode(key, stored.get(key)));
  }
  return out;
}
