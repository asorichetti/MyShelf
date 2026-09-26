import { useCallback, useEffect, useState } from 'react';

import { settingsRepo, useDatabase } from '@/db';
import type { AppSettings, SettingKey } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';

export interface UseSettings {
  /** Every setting with defaults filled in; null while loading. */
  settings: AppSettings | null;
  /** Saves one setting at once (changes apply immediately) and tells the rest of the app. */
  set: <K extends SettingKey>(key: K, value: AppSettings[K]) => Promise<void>;
}

/**
 * Typed access to the settings table for the Settings screens (P08-01).
 * Updates optimistically, persists, then emits `settings-changed` so every
 * screen and watcher using a setting picks it up.
 */
export function useSettings(): UseSettings {
  const db = useDatabase();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    settingsRepo
      .getAllSettings(db)
      .then((all) => active && setSettings(all))
      .catch((e) => console.error('Could not load settings', e));
    return () => {
      active = false;
    };
  }, [db, version]);
  useLibraryEvent('settings-changed', () => setVersion((v) => v + 1));

  const set = useCallback(
    async <K extends SettingKey>(key: K, value: AppSettings[K]) => {
      setSettings((current) => (current ? { ...current, [key]: value } : current));
      await settingsRepo.setSetting(db, key, value);
      emit('settings-changed');
    },
    [db],
  );

  return { settings, set };
}
