import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { ChoiceGroup, SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, Card, Text, TextField, useSnackbar } from '@/components/ui';
import { backupRepo, LATEST_VERSION, useDatabase, type SnapshotInfo } from '@/db';
import { describeCounts, formatDate, toIsoDate, type BackupFile, type BackupTableName } from '@/domain';
import { drainCoverBackfill } from '@/features/covers';
import { emit } from '@/features/events';
import { BackupError, JSON_MIME, parseBackup, restoreBackup, undoRestore, type RestoreMode, type RestoreResult } from '@/services/backup';
import { pickTextFile } from '@/services/backup/pickFile';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { appVersion } from './appInfo';
import { goToShelf } from './goToShelf';
import { announceLibraryReplaced } from './libraryEvents';
import { openScratchDatabase } from './scratchDatabase';
import { SettingsPage } from './SettingsPage';

const T = Testids.restore;
const CONFIRM_WORD = 'REPLACE';

const dateOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : formatDate(toIsoDate(d));
};

type Picked = { name: string; backup: BackupFile; counts: Partial<Record<BackupTableName, number>> };

type Stage =
  | { kind: 'choose' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; picked: Picked }
  | { kind: 'restoring'; picked: Picked }
  | { kind: 'done'; result: RestoreResult; picked: Picked };

function describeResult(result: RestoreResult): string {
  if (result.mode === 'merge') {
    const { booksAdded, booksSkipped } = result.merge!;
    const added = booksAdded === 1 ? 'Added 1 book' : `Added ${booksAdded} books`;
    return booksSkipped ? `${added}. ${booksSkipped === 1 ? '1 was' : `${booksSkipped} were`} already on your shelf.` : `${added}.`;
  }
  return `Your library now has ${describeCounts(result.counts)}.`;
}

/**
 * Settings → Restore from a backup (P08-03): pick a backup file, see what is
 * in it, then Replace (typed confirmation; a safety copy of the current
 * library is kept for Undo) or Merge (adds what is missing). The file is
 * checked before anything changes and the restore runs in one transaction.
 */
export function RestoreScreen() {
  const db = useDatabase();
  const { spacing } = useTheme();
  const { show } = useSnackbar();
  const [stage, setStage] = useState<Stage>({ kind: 'choose' });
  const [mode, setMode] = useState<RestoreMode>('replace');
  const [typed, setTyped] = useState('');
  const [safety, setSafety] = useState<SnapshotInfo | null>(null);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    let active = true;
    backupRepo
      .latestSnapshotInfo(db)
      .then((info) => active && setSafety(info))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [db, stage.kind]);

  const pick = async () => {
    setStage({ kind: 'reading' });
    try {
      const file = await pickTextFile([JSON_MIME, '.json']);
      if (!file) {
        setStage({ kind: 'choose' });
        return;
      }
      const backup = parseBackup(file.text, { currentSchemaVersion: LATEST_VERSION });
      const counts = Object.fromEntries(Object.entries(backup.tables).map(([k, rows]) => [k, rows?.length ?? 0]));
      setTyped('');
      setStage({ kind: 'ready', picked: { name: file.name, backup, counts } });
    } catch (e) {
      if (!(e instanceof BackupError)) console.error('Could not read the backup file', e);
      setStage({ kind: 'error', message: e instanceof BackupError ? e.message : 'Sorry, that file couldn’t be opened. Nothing was changed.' });
    }
  };

  const restore = async () => {
    if (stage.kind !== 'ready') return;
    const { picked } = stage;
    setStage({ kind: 'restoring', picked });
    try {
      const result = await restoreBackup(db, picked.backup, { mode, openScratch: openScratchDatabase, appVersion: appVersion() });
      announceLibraryReplaced();
      // Books whose covers lived on the old phone get real ones again, in the background.
      void drainCoverBackfill(db, { onAttached: () => emit('library-changed') });
      setStage({ kind: 'done', result, picked });
    } catch (e) {
      if (!(e instanceof BackupError)) console.error('Could not restore the backup', e);
      setStage({ kind: 'error', message: e instanceof BackupError ? e.message : 'Sorry, the restore didn’t work. Nothing was changed.' });
    }
  };

  const undo = async () => {
    if (!safety) return;
    setUndoing(true);
    try {
      const ok = await undoRestore(db, safety.id, { openScratch: openScratchDatabase });
      announceLibraryReplaced();
      show({ message: ok ? 'Your library is back as it was.' : 'There was nothing to undo.' });
      setSafety(null);
      setStage({ kind: 'choose' });
    } catch (e) {
      console.error('Could not undo the restore', e);
      show({ message: 'Sorry, I couldn’t undo that. Your library is unchanged.' });
    } finally {
      setUndoing(false);
    }
  };

  const picked = stage.kind === 'ready' || stage.kind === 'restoring' ? stage.picked : null;
  const confirmed = mode === 'merge' || typed.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <SettingsPage
      title="Restore from a backup"
      intro="Choose a backup file MyShelf saved. You’ll see what’s in it before anything changes."
      testID={T.root}
      backTestID={T.back}
    >
      {stage.kind === 'done' ? (
        <View style={{ gap: spacing.md }}>
          <SettingsNotice tone="success" title={stage.result.mode === 'merge' ? 'Books added' : 'Library restored'} testID={T.summary} focusOnShow>
            {describeResult(stage.result)}
          </SettingsNotice>
          {stage.result.upgradedFrom ? (
            <Text variant="caption" color="inkMuted">
              The backup came from an older version of MyShelf and was brought up to date.
            </Text>
          ) : null}
          <Button label="See your shelf" block onPress={goToShelf} />
          {stage.result.mode === 'replace' && safety ? (
            <Button label="Undo restore" variant="secondary" block loading={undoing} onPress={() => void undo()} testID={T.undo} />
          ) : null}
        </View>
      ) : (
        <>
          <Button
            label={picked ? 'Choose a different file' : 'Choose a backup file'}
            variant={picked ? 'secondary' : 'primary'}
            block
            loading={stage.kind === 'reading'}
            disabled={stage.kind === 'restoring'}
            onPress={() => void pick()}
            testID={T.pick}
          />
          {stage.kind === 'error' ? (
            <SettingsNotice tone="danger" title="That file can’t be restored" testID={T.error}>
              {stage.message}
            </SettingsNotice>
          ) : null}
          {picked ? (
            <View style={{ gap: spacing.lg }}>
              <Card title={picked.name} eyebrow="Backup file" titleLevel={2} testID={T.file}>
                <Text>{`It holds ${describeCounts(picked.counts)}.`}</Text>
                <Text variant="caption" color="inkMuted">
                  {[
                    dateOf(picked.backup.exportedAt) ? `Saved ${dateOf(picked.backup.exportedAt)}` : null,
                    picked.backup.appVersion !== 'unknown' ? `by MyShelf ${picked.backup.appVersion}` : null,
                    picked.backup.schemaVersion < LATEST_VERSION ? 'from an older version; it will be brought up to date' : null,
                  ]
                    .filter(Boolean)
                    .join(' ') || ' '}
                </Text>
              </Card>
              <ChoiceGroup<RestoreMode>
                label="How should it be restored?"
                value={mode}
                onChange={setMode}
                options={[
                  {
                    value: 'replace',
                    label: 'Replace my library',
                    description: 'Everything on this phone is swapped for the backup. A safety copy is kept so you can undo.',
                    testID: T.modeReplace,
                  },
                  {
                    value: 'merge',
                    label: 'Add to my library',
                    description: 'Books you don’t have yet are added. Nothing is removed or changed.',
                    testID: T.modeMerge,
                  },
                ]}
              />
              {mode === 'replace' ? (
                <TextField
                  label={`Type ${CONFIRM_WORD} to confirm`}
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  helperText="Your current library will be replaced."
                  testID={T.confirmInput}
                />
              ) : null}
              <Button
                label={mode === 'replace' ? 'Replace my library' : 'Add these books'}
                variant={mode === 'replace' ? 'danger' : 'primary'}
                block
                disabled={!confirmed}
                loading={stage.kind === 'restoring'}
                onPress={() => void restore()}
                testID={T.confirm}
              />
            </View>
          ) : null}
          {!picked && stage.kind !== 'error' ? (
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Booky expression="happy" size={88} />
              <Text color="inkMuted" align="center">
                Backups are files named like myshelf-backup-2026-10-12.json.
              </Text>
            </View>
          ) : null}
          {safety && !picked ? (
            <SettingsNotice
              tone="info"
              title="Changed your mind?"
              role="none"
              actions={<Button label="Undo the last restore" variant="secondary" loading={undoing} onPress={() => void undo()} testID={T.undo} />}
            >
              {`MyShelf kept a copy of your library from just before the last restore (${dateOf(safety.createdAt) ?? 'recently'}, ${safety.bookCount === 1 ? '1 book' : `${safety.bookCount} books`}).`}
            </SettingsNotice>
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}
