import type { Db } from '../types';

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.get<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string | null): Promise<void> {
  await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function deleteSetting(db: Db, key: string): Promise<boolean> {
  return (await db.run('DELETE FROM settings WHERE key = ?', [key])).changes > 0;
}

export async function listSettings(db: Db): Promise<Record<string, string | null>> {
  const rows = await db.all<{ key: string; value: string | null }>('SELECT key, value FROM settings ORDER BY key');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
