import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { CheckboxRow, SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, Text, TextField, useSnackbar } from '@/components/ui';
import { backupRepo, useDatabase } from '@/db';
import { describeCounts, setDateFormat, settingDefaults } from '@/domain';
import { goBackOr } from '@/features/navigation/goBack';
import { eraseAll } from '@/services/backup';
import { deleteAllCovers } from '@/services/covers';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';


import { goToShelf } from './goToShelf';
import { announceLibraryReplaced } from './libraryEvents';
import { SettingsPage } from './SettingsPage';

const T = Testids.erase;
const CONFIRM_WORD = 'ERASE';

/**
 * Settings → Erase library (P08-09), in two steps: first what will be lost
 * (with a nudge to back up first and a choice to reset settings too), then
 * type ERASE. Afterwards the app is back to an empty Shelf.
 */
export function EraseScreen() {
  const db = useDatabase();
  const { spacing } = useTheme();
  const { show } = useSnackbar();
  const [counts, setCounts] = useState<string | null>(null);
  const [resetSettings, setResetSettings] = useState(false);
  const [step, setStep] = useState<'explain' | 'confirm'>('explain');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    backupRepo
      .countTables(db)
      .then((c) => active && setCounts(describeCounts(c)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [db]);

  const erase = async () => {
    setBusy(true);
    setError(null);
    try {
      await eraseAll(db, { resetSettings, deleteCoverFiles: deleteAllCovers });
      if (resetSettings) setDateFormat(settingDefaults.dateFormat);
      announceLibraryReplaced();
      goToShelf();
      show({ message: 'Your library was erased. A fresh start!' });
    } catch (e) {
      console.error('Could not erase the library', e);
      setError('Sorry, the library couldn’t be erased. Nothing was changed.');
      setBusy(false);
    }
  };

  return (
    <SettingsPage title="Erase library" intro="Remove every book from this phone, for a fresh start." testID={T.root} backTestID={T.back}>
      {step === 'explain' ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ alignItems: 'center' }}>
            <Booky expression="concerned" size={96} />
          </View>
          <SettingsNotice tone="warn" title="This can’t be undone" role="none">
            {`Erasing removes ${counts ?? 'every book'}, with their authors, genres, series, groups, borrowers and loan history, any lookups still waiting, and saved covers.`}
          </SettingsNotice>
          <Text color="inkMuted">If there’s any chance you’ll want them back, save a backup first.</Text>
          <Button label="Save a backup first" variant="secondary" block onPress={() => router.navigate('/settings/backup')} testID={T.backupFirst} />
          <CheckboxRow
            label="Also reset my settings"
            description="Shelf order, loan length, date format and the rest go back to how they started."
            checked={resetSettings}
            onChange={setResetSettings}
            testID={T.resetSettings}
          />
          <Button label="Continue" variant="danger" block onPress={() => setStep('confirm')} testID={T.next} />
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Text>{`Last step. Type ${CONFIRM_WORD} to remove ${counts ?? 'your library'}${resetSettings ? ' and reset your settings' : ''}.`}</Text>
          <TextField
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            testID={T.confirmInput}
          />
          {error ? (
            <SettingsNotice tone="danger">{error}</SettingsNotice>
          ) : null}
          <Button
            label="Erase everything"
            variant="danger"
            block
            disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
            loading={busy}
            onPress={() => void erase()}
            testID={T.confirm}
          />
          <Button label="Keep my library" variant="ghost" block onPress={() => goBackOr('/settings')} />
        </View>
      )}
    </SettingsPage>
  );
}
