import { useEffect } from 'react';

import { settingsRepo, useDatabase } from '@/db';
import { appearances, setDateFormat, type Appearance } from '@/domain';
import { useLibraryEvent } from '@/features/events';
import { useThemePreference } from '@/theme';

import { useBackupReminder } from './useBackupReminder';

/** Applies the date format setting to every `formatDate` call, now and whenever it changes. */
function useDateFormatSetting(): void {
  const db = useDatabase();
  const apply = () => {
    settingsRepo
      .getSetting(db, 'dateFormat')
      .then(setDateFormat)
      .catch(() => undefined);
  };
   
  useEffect(apply, [db]);
  useLibraryEvent('settings-changed', apply);
}

/** Applies the Appearance setting (System, Light or Dark) to the theme, now and whenever it changes. */
function useAppearanceSetting(): void {
  const db = useDatabase();
  const { setPreference } = useThemePreference();
  const apply = () => {
    settingsRepo
      .getSetting(db, 'appearance')
      // A stored value this app does not know (an edited backup, say) means System.
      .then((value) => setPreference(appearances.includes(value as Appearance) ? value : 'system'))
      .catch(() => undefined);
  };
  useEffect(apply, [db, setPreference]);
  useLibraryEvent('settings-changed', apply);
}

/** App-wide settings upkeep: the date format, the appearance and Booky's backup reminder. Renders nothing. */
export function SettingsWatchers() {
  useDateFormatSetting();
  useAppearanceSetting();
  useBackupReminder();
  return null;
}
