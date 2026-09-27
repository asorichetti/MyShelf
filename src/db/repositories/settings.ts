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

/** A setting's value, or its default when unset, unreadable or of the wrong type. */
export async function getSetting<K extends SettingKey>(db: Db, key: K): Promise<AppSettings[K]> {
  const row = await db.get<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
  return decode(key, row?.value);
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
    if (stored.has(key)) (out as unknown as Record<string, unknown>)[key] = decode(key, stored.get(key));
  }
  return out;
}
