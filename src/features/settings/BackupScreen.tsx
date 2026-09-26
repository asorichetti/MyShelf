import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, Card, Text } from '@/components/ui';
import { backupRepo, settingsRepo, useDatabase } from '@/db';
import { backupFileName, describeCounts } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';
import { exportBackup, JSON_MIME, serializeBackup } from '@/services/backup';
import { shareFile } from '@/services/backup/shareFile';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { appVersion } from './appInfo';
import { lastBackupLabel } from './lastBackup';
import { SettingsPage } from './SettingsPage';

const T = Testids.backup;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; fileName: string; how: 'shared' | 'downloaded' } | { kind: 'error'; message: string };

/**
 * Settings → Back up your library (P08-02): what a backup holds, then one
 * button that writes `myshelf-backup-YYYY-MM-DD.json` and opens the share
 * sheet (a download on the web). Records when it was done.
 */
export function BackupScreen() {
  const db = useDatabase();
  const { spacing } = useTheme();
  const [contents, setContents] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [version, setVersion] = useState(0);
  useLibraryEvent(['library-changed', 'loans-changed', 'groups-changed', 'settings-changed'], () => setVersion((v) => v + 1));

  useEffect(() => {
    let active = true;
    Promise.all([backupRepo.countTables(db), settingsRepo.getSetting(db, 'backup.lastAt')])
      .then(([counts, last]) => {
        if (!active) return;
        setContents(describeCounts(counts));
        setLastAt(last);
      })
      .catch((e) => console.error('Could not read the library for the backup screen', e));
    return () => {
      active = false;
    };
  }, [db, version]);

  const save = async () => {
    setStatus({ kind: 'busy' });
    try {
      const now = new Date();
      const backup = await exportBackup(db, { appVersion: appVersion(), now: () => now });
      const fileName = backupFileName(now);
      const outcome = await shareFile({ fileName, mimeType: JSON_MIME, text: serializeBackup(backup), dialogTitle: 'Save your MyShelf backup' });
      if (outcome === 'unavailable') {
        setStatus({ kind: 'error', message: 'This phone can’t share files right now, so the backup couldn’t be saved.' });
        return;
      }
      await settingsRepo.setSetting(db, 'backup.lastAt', now.toISOString());
      await settingsRepo.setSetting(db, 'backup.snoozedUntil', null);
      emit('settings-changed');
      setStatus({ kind: 'done', fileName, how: outcome });
    } catch (e) {
      console.error('Could not make a backup', e);
      setStatus({ kind: 'error', message: 'Sorry, the backup couldn’t be made. Your library is fine; please try again.' });
    }
  };

  return (
    <SettingsPage
      title="Back up your library"
      intro="One file with every book, author, series, group, borrower, loan and preference. Keep it somewhere safe: Google Drive, an email to yourself, or your computer."
      testID={T.root}
      backTestID={T.back}
    >
      <Card title="What’s in it" eyebrow="Backup">
        <View style={{ gap: spacing.sm }}>
          <Text testID={T.contents}>{contents == null ? 'Counting your books…' : `Right now: ${contents}.`}</Text>
          <Text variant="caption" color="inkMuted">
            Covers saved on this phone aren’t in the file; MyShelf fetches them again after a restore. Nothing is uploaded anywhere: you choose where the file goes.
          </Text>
          <Text variant="caption" color="inkMuted">{`Last backup: ${lastBackupLabel(lastAt)}`}</Text>
        </View>
      </Card>
      <Button label="Save a backup" onPress={() => void save()} loading={status.kind === 'busy'} block testID={T.export} />
      {status.kind === 'done' ? (
        <SettingsNotice tone="success" title="Backup saved" testID={T.status}>
          {status.how === 'downloaded' ? `Downloaded ${status.fileName}.` : `${status.fileName} is ready. Keep it somewhere safe.`}
        </SettingsNotice>
      ) : null}
      {status.kind === 'error' ? (
        <SettingsNotice tone="danger" testID={T.status}>
          {status.message}
        </SettingsNotice>
      ) : null}
      <Button label="Restore from a backup instead" variant="ghost" onPress={() => router.navigate('/settings/restore')} />
    </SettingsPage>
  );
}
