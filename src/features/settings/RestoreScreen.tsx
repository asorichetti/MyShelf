import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { ChoiceGroup, SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, Card, Text, TextField, useSnackbar } from '@/components/ui';
import { backupRepo, LATEST_VERSION, useDatabase, type SnapshotInfo } from '@/db';
import { describeCounts, formatDate, toIsoDate, type BackupFile, type BackupTableName } from '@/domain';
import { drainCoverBackfill, replacingLibrary } from '@/features/covers';
import { emit } from '@/features/events';
import { t } from '@/i18n';
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
    const added = t('restore.result.added', { count: booksAdded });
    return booksSkipped ? [added, t('restore.result.alreadyOnShelf', { count: booksSkipped })].join(t('backup.sentenceSeparator')) : added;
  }
  return t('restore.result.libraryNowHas', { contents: describeCounts(result.counts) });
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
      setStage({ kind: 'error', message: e instanceof BackupError ? e.message : t('restore.screen.openFailed') });
    }
  };

  const restore = async () => {
    if (stage.kind !== 'ready') return;
    const { picked } = stage;
    setStage({ kind: 'restoring', picked });
    try {
      // The covers the replaced safety copy alone named go; the library's own stay with the new one.
      const result = await replacingLibrary(db, () => restoreBackup(db, picked.backup, { mode, openScratch: openScratchDatabase, appVersion: appVersion() }));
      announceLibraryReplaced();
      // Books whose covers lived on the old phone get real ones again, in the background.
      void drainCoverBackfill(db, { onAttached: () => emit('library-changed') });
      setStage({ kind: 'done', result, picked });
    } catch (e) {
      if (!(e instanceof BackupError)) console.error('Could not restore the backup', e);
      setStage({ kind: 'error', message: e instanceof BackupError ? e.message : t('restore.screen.restoreFailed') });
    }
  };

  const undo = async () => {
    if (!safety) return;
    setUndoing(true);
    try {
      // The covers fetched for the restored books go; the original library's come back with it.
      const ok = await replacingLibrary(db, () => undoRestore(db, safety.id, { openScratch: openScratchDatabase }));
      announceLibraryReplaced();
      show({ message: ok ? t('restore.undo.done') : t('restore.undo.nothingToUndo') });
      setSafety(null);
      setStage({ kind: 'choose' });
    } catch (e) {
      console.error('Could not undo the restore', e);
      show({ message: t('restore.undo.failed') });
    } finally {
      setUndoing(false);
    }
  };

  const picked = stage.kind === 'ready' || stage.kind === 'restoring' ? stage.picked : null;
  const savedOn = picked ? dateOf(picked.backup.exportedAt) : null;
  const confirmWord = t('restore.confirm.word');
  const confirmed = mode === 'merge' || typed.trim().toUpperCase() === confirmWord;

  return (
    <SettingsPage
      title={t('restore.screen.title')}
      intro={t('restore.screen.intro')}
      testID={T.root}
      backTestID={T.back}
    >
      {stage.kind === 'done' ? (
        <View style={{ gap: spacing.md }}>
          <SettingsNotice tone="success" title={stage.result.mode === 'merge' ? t('restore.result.mergedTitle') : t('restore.result.replacedTitle')} testID={T.summary} focusOnShow>
            {describeResult(stage.result)}
          </SettingsNotice>
          {stage.result.upgradedFrom ? (
            <Text variant="caption" color="inkMuted">
              {t('restore.result.upgraded')}
            </Text>
          ) : null}
          <Button label={t('restore.result.seeShelf')} block onPress={goToShelf} />
          {stage.result.mode === 'replace' && safety ? (
            <Button label={t('restore.result.undo')} variant="secondary" block loading={undoing} onPress={() => void undo()} testID={T.undo} />
          ) : null}
        </View>
      ) : (
        <>
          <Button
            label={picked ? t('restore.screen.chooseDifferentFile') : t('restore.screen.chooseFile')}
            variant={picked ? 'secondary' : 'primary'}
            block
            loading={stage.kind === 'reading'}
            disabled={stage.kind === 'restoring'}
            onPress={() => void pick()}
            testID={T.pick}
          />
          {stage.kind === 'error' ? (
            <SettingsNotice tone="danger" title={t('restore.screen.errorTitle')} testID={T.error}>
              {stage.message}
            </SettingsNotice>
          ) : null}
          {picked ? (
            <View style={{ gap: spacing.lg }}>
              <Card title={picked.name} eyebrow={t('restore.file.eyebrow')} titleLevel={2} testID={T.file}>
                <Text>{t('restore.file.holds', { contents: describeCounts(picked.counts) })}</Text>
                <Text variant="caption" color="inkMuted">
                  {[
                    savedOn ? t('restore.file.savedOn', { date: savedOn }) : null,
                    picked.backup.appVersion !== 'unknown' ? t('restore.file.byVersion', { version: picked.backup.appVersion }) : null,
                    picked.backup.schemaVersion < LATEST_VERSION ? t('restore.file.fromOlderVersion') : null,
                  ]
                    .filter(Boolean)
                    .join(t('restore.file.detailsSeparator')) || ' '}
                </Text>
              </Card>
              <ChoiceGroup<RestoreMode>
                label={t('restore.mode.label')}
                value={mode}
                onChange={setMode}
                options={[
                  {
                    value: 'replace',
                    label: t('restore.mode.replace'),
                    description: t('restore.mode.replaceDescription'),
                    testID: T.modeReplace,
                  },
                  {
                    value: 'merge',
                    label: t('restore.mode.merge'),
                    description: t('restore.mode.mergeDescription'),
                    testID: T.modeMerge,
                  },
                ]}
              />
              {mode === 'replace' ? (
                <TextField
                  label={t('restore.confirm.label', { word: confirmWord })}
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  helperText={t('restore.confirm.helper')}
                  testID={T.confirmInput}
                />
              ) : null}
              <Button
                label={mode === 'replace' ? t('restore.confirm.replace') : t('restore.confirm.merge')}
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
                {t('restore.screen.fileNameHint')}
              </Text>
            </View>
          ) : null}
          {safety && !picked ? (
            <SettingsNotice
              tone="info"
              title={t('restore.undo.title')}
              role="none"
              actions={<Button label={t('restore.undo.button')} variant="secondary" loading={undoing} onPress={() => void undo()} testID={T.undo} />}
            >
              {t('restore.undo.body', { date: dateOf(safety.createdAt) ?? t('restore.undo.recently'), books: t('common.books', { count: safety.bookCount }) })}
            </SettingsNotice>
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}
