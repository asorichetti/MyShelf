import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HelpButton } from '@/components/booky';
import { ReminderSwitch } from '@/components/loans/ReminderSwitch';
import { SettingsDivider, SettingsLinkRow, SettingsSection, SettingsSwitchRow } from '@/components/settings/SettingsRow';
import { Heading, Screen, Text } from '@/components/ui';
import { loansRepo, pendingLookupsRepo, useDatabase } from '@/db';
import type { AppSettings } from '@/domain';
import { BookySettingsSection } from '@/features/booky/BookySettingsSection';
import { useLibraryEvent } from '@/features/events';
import { useReminderSetting } from '@/features/loans/useReminderSync';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { appVersion, GOOGLE_BOOKS_KEYED } from './appInfo';
import { lastBackupLabel } from './lastBackup';
import { loanLengthLabel, sortLabel, storedPresets, storedSort } from './preferenceOptions';
import { useSettings } from './useSettings';

import type { ReactNode } from 'react';

const T = Testids.settings;
const go = (href: Href) => () => router.navigate(href);

function useCounts() {
  const db = useDatabase();
  const [counts, setCounts] = useState<{ pending: number; borrowers: number } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([pendingLookupsRepo.list(db), loansRepo.listBorrowers(db)])
      .then(([pending, borrowers]) => active && setCounts({ pending: pending.length, borrowers: borrowers.length }))
      .catch((e) => console.error('Could not count pending lookups and borrowers', e));
    return () => {
      active = false;
    };
  }, [db, version]);
  useLibraryEvent(['library-changed', 'loans-changed', 'pending-changed'], () => setVersion((v) => v + 1));
  return counts;
}

function googleBooksNote(settings: AppSettings): string {
  if (!settings.googleBooksEnabled) return t('settings.lookups.googleBooksOff');
  return GOOGLE_BOOKS_KEYED
    ? t('settings.lookups.googleBooksKeyed')
    : t('settings.lookups.googleBooksUnkeyed');
}

function LendingRows() {
  const { spacing } = useTheme();
  const reminders = useReminderSetting();
  const note = !reminders.supported
    ? t('settings.lending.remindersUnsupported')
    : reminders.denied
      ? t('settings.lending.remindersDenied')
      : null;
  return (
    <View style={{ paddingHorizontal: spacing.xs }}>
      <ReminderSwitch value={reminders.enabled === true} onChange={(on) => void reminders.setEnabled(on)} disabled={!reminders.supported || reminders.busy} note={note} />
    </View>
  );
}

/**
 * The Settings tab (P08-01): grouped sections of rows. Every row has a label,
 * its value or an explanation, and a role (link or switch); switches apply
 * at once and persist. Detail lives on screens under `/settings/…`.
 */
export function SettingsScreen() {
  const { spacing } = useTheme();
  const { settings, set } = useSettings();
  const counts = useCounts();

  if (!settings) return <LoadingPage />;

  // Booky (P07-06): how chatty Booky is, reset tips, the welcome tour.
  const bookySection: ReactNode = <BookySettingsSection />;

  return (
    <Screen testID={T.root}>
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Heading level={1} testID={T.title} style={{ flex: 1 }}>
            {t('settings.screen.title')}
          </Heading>
          <HelpButton screen="settings" />
        </View>
        <Text color="inkMuted">{t('settings.screen.intro')}</Text>
      </View>

      <SettingsSection title={t('settings.library.title')} intro={t('settings.library.intro')} testID={T.section}>
        <SettingsLinkRow
          icon="bookshelf"
          label={t('settings.library.preferencesLabel')}
          description={t('settings.library.preferencesDescription', {
            sort: sortLabel(storedSort(settings.shelfSort), storedPresets(settings.shelfSortPresets)),
            loanLength: loanLengthLabel(settings.loanDays),
          })}
          onPress={go('/settings/preferences')}
          testID={T.preferences}
        />
      </SettingsSection>

      {bookySection}

      <SettingsSection title={t('settings.lookups.title')} intro={t('settings.lookups.intro')} testID={T.section}>
        <SettingsSwitchRow
          icon="book-search-outline"
          label={t('settings.lookups.googleBooksLabel')}
          description={googleBooksNote(settings)}
          value={settings.googleBooksEnabled}
          onChange={(on) => void set('googleBooksEnabled', on)}
          testID={T.googleBooksToggle}
        />
        <SettingsDivider />
        <SettingsSwitchRow
          icon="image-outline"
          label={t('settings.lookups.coversLabel')}
          description={settings.coversOnMobileData ? t('settings.lookups.coversAnyConnection') : t('settings.lookups.coversWifiOnly')}
          value={settings.coversOnMobileData}
          onChange={(on) => void set('coversOnMobileData', on)}
          testID={T.coversOnDataToggle}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="timer-sand"
          label={t('settings.lookups.pendingLabel')}
          description={t('settings.lookups.pendingDescription')}
          value={counts ? (counts.pending ? t('settings.lookups.pendingWaiting', { count: counts.pending }) : t('settings.lookups.pendingNone')) : null}
          onPress={go('/settings/pending')}
          testID={T.pending}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.lending.title')} testID={T.section}>
        <LendingRows />
        <SettingsDivider />
        <SettingsLinkRow
          icon="account-multiple-outline"
          label={t('settings.lending.borrowersLabel')}
          description={t('settings.lending.borrowersDescription')}
          value={counts ? t('settings.lending.borrowersCount', { count: counts.borrowers }) : null}
          onPress={go('/settings/borrowers')}
          testID={T.borrowers}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.data.title')} intro={t('settings.data.intro')} testID={T.section}>
        <SettingsLinkRow
          icon="content-save-outline"
          label={t('settings.data.backUpLabel')}
          description={t('settings.data.backUpDescription')}
          value={t('settings.data.lastBackup', { when: lastBackupLabel(settings['backup.lastAt']) })}
          onPress={go('/settings/backup')}
          testID={T.exportBackup}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="backup-restore"
          label={t('settings.data.restoreLabel')}
          description={t('settings.data.restoreDescription')}
          onPress={go('/settings/restore')}
          testID={T.importBackup}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="file-delimited-outline"
          label={t('settings.data.exportCsvLabel')}
          description={t('settings.data.exportCsvDescription')}
          onPress={go('/settings/export-csv')}
          testID={T.exportCsv}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="file-import-outline"
          label={t('settings.data.importCsvLabel')}
          description={t('settings.data.importCsvDescription')}
          onPress={go('/settings/import-csv')}
          testID={T.importCsv}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="delete-outline"
          tone="danger"
          label={t('settings.data.eraseLabel')}
          description={t('settings.data.eraseDescription')}
          onPress={go('/settings/erase')}
          testID={T.erase}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.about.title')} testID={T.section}>
        <SettingsLinkRow
          icon="information-outline"
          label={t('settings.about.label')}
          description={t('settings.about.description')}
          value={t('settings.about.version', { version: appVersion() })}
          onPress={go('/settings/about')}
          testID={T.about}
        />
      </SettingsSection>
    </Screen>
  );
}
