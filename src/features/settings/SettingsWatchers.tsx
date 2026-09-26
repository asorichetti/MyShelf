import { useEffect } from 'react';

import { settingsRepo, useDatabase } from '@/db';
import { setDateFormat } from '@/domain';
import { useLibraryEvent } from '@/features/events';

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

/** App-wide settings upkeep: the date format and Booky's backup reminder. Renders nothing. */
export function SettingsWatchers() {
  useDateFormatSetting();
  useBackupReminder();
  return null;
}
