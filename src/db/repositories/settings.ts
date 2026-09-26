import { settingDefaults, type AppSettings, type SettingKey } from '@/domain';

import type { Db } from '../types';

function decode<K extends SettingKey>(key: K, raw: string | null | undefined): AppSettings[K] {
  if (raw == null) return settingDefaults[key];
  try {
    return JSON.parse(raw) as AppSettings[K];
  } catch {
    return settingDefaults[key];
  }
}

/** A setting's value, or its default when unset or unreadable. */
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
