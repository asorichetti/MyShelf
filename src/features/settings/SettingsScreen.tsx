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
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { appVersion, GOOGLE_BOOKS_KEYED } from './appInfo';
import { lastBackupLabel } from './lastBackup';
import { loanLengthLabel, sortLabel } from './preferenceOptions';
import { useSettings } from './useSettings';

import type { ReactNode } from 'react';

const T = Testids.settings;
const go = (href: Href) => () => router.navigate(href);
const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

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
  if (!settings.googleBooksEnabled) return 'Only Open Library is asked for book details.';
  return GOOGLE_BOOKS_KEYED
    ? 'Asked alongside Open Library, with this build’s own Google Books access.'
    : 'Asked alongside Open Library. Without its own access key, Google Books can be slow at busy times.';
}

function LendingRows() {
  const { spacing } = useTheme();
  const reminders = useReminderSetting();
  const note = !reminders.supported
    ? 'Reminders work in the Android app.'
    : reminders.denied
      ? 'Notifications are turned off for MyShelf. You can allow them in your phone’s settings, then try again.'
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
            Settings
          </Heading>
          <HelpButton screen="settings" />
        </View>
        <Text color="inkMuted">Everything here stays on this phone. There are no accounts and nothing to sign in to.</Text>
      </View>

      <SettingsSection title="Library" intro="How your shelf looks when you open it, and how long loans last." testID={T.section}>
        <SettingsLinkRow
          icon="bookshelf"
          label="Shelf and lending"
          description={`${sortLabel(settings.shelfSort)} · lend for ${loanLengthLabel(settings.loanDays)}`}
          onPress={go('/settings/preferences')}
          testID={T.preferences}
        />
      </SettingsSection>

      {bookySection}

      <SettingsSection title="Lookups" intro="Where MyShelf finds book details and covers. Only ISBNs and search words are sent." testID={T.section}>
        <SettingsSwitchRow
          icon="book-search-outline"
          label="Ask Google Books too"
          description={googleBooksNote(settings)}
          value={settings.googleBooksEnabled}
          onChange={(on) => void set('googleBooksEnabled', on)}
          testID={T.googleBooksToggle}
        />
        <SettingsDivider />
        <SettingsSwitchRow
          icon="image-outline"
          label="Fetch covers on mobile data"
          description={settings.coversOnMobileData ? 'Missing covers are fetched on any connection.' : 'Missing covers wait for Wi-Fi.'}
          value={settings.coversOnMobileData}
          onChange={(on) => void set('coversOnMobileData', on)}
          testID={T.coversOnDataToggle}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="timer-sand"
          label="Pending lookups"
          description="ISBNs waiting for the internet"
          value={counts ? (counts.pending ? `${counts.pending} waiting` : 'None') : null}
          onPress={go('/settings/pending')}
          testID={T.pending}
        />
      </SettingsSection>

      <SettingsSection title="Lending" testID={T.section}>
        <LendingRows />
        <SettingsDivider />
        <SettingsLinkRow
          icon="account-multiple-outline"
          label="Borrowers"
          description="Rename or remove the people you lend to"
          value={counts ? count(counts.borrowers, 'person', 'people') : null}
          onPress={go('/settings/borrowers')}
          testID={T.borrowers}
        />
      </SettingsSection>

      <SettingsSection title="Backup & data" intro="Your library lives only on this phone. A backup file keeps it safe." testID={T.section}>
        <SettingsLinkRow
          icon="content-save-outline"
          label="Back up your library"
          description="Save a file you can restore on any phone"
          value={`Last: ${lastBackupLabel(settings['backup.lastAt'])}`}
          onPress={go('/settings/backup')}
          testID={T.exportBackup}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="backup-restore"
          label="Restore from a backup"
          description="Bring back a library from a backup file"
          onPress={go('/settings/restore')}
          testID={T.importBackup}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="file-delimited-outline"
          label="Export as a spreadsheet"
          description="A CSV file of your books for Excel or Sheets"
          onPress={go('/settings/export-csv')}
          testID={T.exportCsv}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="file-import-outline"
          label="Import books from a spreadsheet"
          description="A CSV file, including a Goodreads export"
          onPress={go('/settings/import-csv')}
          testID={T.importCsv}
        />
        <SettingsDivider />
        <SettingsLinkRow
          icon="delete-outline"
          tone="danger"
          label="Erase library"
          description="Remove every book from this phone"
          onPress={go('/settings/erase')}
          testID={T.erase}
        />
      </SettingsSection>

      <SettingsSection title="About" testID={T.section}>
        <SettingsLinkRow
          icon="information-outline"
          label="About MyShelf"
          description="Credits, licences and privacy"
          value={`Version ${appVersion()}`}
          onPress={go('/settings/about')}
          testID={T.about}
        />
      </SettingsSection>
    </Screen>
  );
}
