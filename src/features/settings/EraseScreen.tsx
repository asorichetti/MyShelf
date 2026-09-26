import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Booky } from '@/components/booky';
import { CheckboxRow, SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, Text, TextField, useSnackbar } from '@/components/ui';
import { backupRepo, useDatabase } from '@/db';
import { describeCounts, setDateFormat, settingDefaults } from '@/domain';
import { goBackOr } from '@/features/navigation/goBack';
import { t } from '@/i18n';
import { eraseAll } from '@/services/backup';
import { deleteAllCovers } from '@/services/covers';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';


import { goToShelf } from './goToShelf';
import { announceLibraryReplaced } from './libraryEvents';
import { SettingsPage } from './SettingsPage';

const T = Testids.erase;

/**
 * Settings → Erase library (P08-09), in two steps: first what will be lost
 * (with a nudge to back up first and a choice to reset settings too), then
 * type ERASE (`erase.confirm.word`). Afterwards the app is back to an empty Shelf.
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
  const confirmWord = t('erase.confirm.word');

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
      show({ message: t('erase.confirm.done') });
    } catch (e) {
      console.error('Could not erase the library', e);
      setError(t('erase.confirm.failed'));
      setBusy(false);
    }
  };

  return (
    <SettingsPage title={t('erase.screen.title')} intro={t('erase.screen.intro')} testID={T.root} backTestID={T.back}>
      {step === 'explain' ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ alignItems: 'center' }}>
            <Booky expression="concerned" size={96} />
          </View>
          <SettingsNotice tone="warn" title={t('erase.screen.warningTitle')} role="none">
            {t('erase.screen.warning', { contents: counts ?? t('erase.screen.everyBook') })}
          </SettingsNotice>
          <Text color="inkMuted">{t('erase.screen.backupNudge')}</Text>
          <Button label={t('erase.screen.backupFirst')} variant="secondary" block onPress={() => router.navigate('/settings/backup')} testID={T.backupFirst} />
          <CheckboxRow
            label={t('erase.screen.resetSettings')}
            description={t('erase.screen.resetSettingsDescription')}
            checked={resetSettings}
            onChange={setResetSettings}
            testID={T.resetSettings}
          />
          <Button label={t('erase.screen.continue')} variant="danger" block onPress={() => setStep('confirm')} testID={T.next} />
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Text>
            {t(resetSettings ? 'erase.confirm.lastStepWithSettings' : 'erase.confirm.lastStep', {
              word: confirmWord,
              contents: counts ?? t('erase.confirm.yourLibrary'),
            })}
          </Text>
          <TextField
            label={t('erase.confirm.label', { word: confirmWord })}
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
            label={t('erase.confirm.erase')}
            variant="danger"
            block
            disabled={typed.trim().toUpperCase() !== confirmWord}
            loading={busy}
            onPress={() => void erase()}
            testID={T.confirm}
          />
          <Button label={t('erase.confirm.keep')} variant="ghost" block onPress={() => goBackOr('/settings')} />
        </View>
      )}
    </SettingsPage>
  );
}
