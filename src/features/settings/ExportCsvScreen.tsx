import { useState } from 'react';
import { View } from 'react-native';

import { SettingsNotice } from '@/components/settings/SettingsControls';
import { SettingsSwitchRow } from '@/components/settings/SettingsRow';
import { Button, Card, Text } from '@/components/ui';
import { useDatabase } from '@/db';
import { CSV_MIME, csvFileName, exportCsv } from '@/services/backup';
import { shareFile } from '@/services/backup/shareFile';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { SettingsPage } from './SettingsPage';

const T = Testids.csvExport;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

/**
 * Settings → Export as a spreadsheet (P08-04): every book as one CSV row for
 * Excel, Numbers or Google Sheets. Lending details only when asked for:
 * borrower names are personal.
 */
export function ExportCsvScreen() {
  const db = useDatabase();
  const { spacing } = useTheme();
  const [includeLoans, setIncludeLoans] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const run = async () => {
    setStatus({ kind: 'busy' });
    try {
      const now = new Date();
      const { text, count } = await exportCsv(db, { includeLoans });
      const fileName = csvFileName(now);
      const outcome = await shareFile({ fileName, mimeType: CSV_MIME, text, dialogTitle: 'Save your book list' });
      if (outcome === 'unavailable') {
        setStatus({ kind: 'error', message: 'This phone can’t share files right now.' });
        return;
      }
      const books = count === 1 ? '1 book' : `${count} books`;
      setStatus({ kind: 'done', message: outcome === 'downloaded' ? `Downloaded ${fileName} with ${books}.` : `${fileName} is ready, with ${books}.` });
    } catch (e) {
      console.error('Could not export the CSV', e);
      setStatus({ kind: 'error', message: 'Sorry, the spreadsheet couldn’t be made. Please try again.' });
    }
  };

  return (
    <SettingsPage
      title="Export as a spreadsheet"
      intro="A CSV file with one row per book, for Excel, Numbers or Google Sheets. It’s a list to read, not a backup: use “Back up your library” to keep everything."
      testID={T.root}
      backTestID={T.back}
    >
      <Card title="Columns" eyebrow="CSV">
        <Text color="inkMuted">
          Title, subtitle, authors, ISBN-13, ISBN-10, publisher, year, pages, format, language, genres, series, number in series, groups, notes and the date added.
        </Text>
      </Card>
      <View style={{ gap: spacing.sm }}>
        <SettingsSwitchRow
          label="Include lending details"
          description="Adds who has each book, when it was lent and when it’s due. Borrower names are personal: share this file with care."
          value={includeLoans}
          onChange={setIncludeLoans}
          testID={T.includeLoans}
        />
      </View>
      <Button label="Export CSV" block loading={status.kind === 'busy'} onPress={() => void run()} testID={T.export} />
      {status.kind === 'done' ? (
        <SettingsNotice tone="success" title="Spreadsheet saved" testID={T.status}>
          {status.message}
        </SettingsNotice>
      ) : null}
      {status.kind === 'error' ? (
        <SettingsNotice tone="danger" testID={T.status}>
          {status.message}
        </SettingsNotice>
      ) : null}
    </SettingsPage>
  );
}
