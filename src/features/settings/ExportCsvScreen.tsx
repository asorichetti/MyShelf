import { useState } from 'react';
import { View } from 'react-native';

import { SettingsNotice } from '@/components/settings/SettingsControls';
import { SettingsSwitchRow } from '@/components/settings/SettingsRow';
import { Button, Card, Text } from '@/components/ui';
import { useDatabase } from '@/db';
import { t } from '@/i18n';
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
      const outcome = await shareFile({ fileName, mimeType: CSV_MIME, text, dialogTitle: t('exportCsv.screen.shareDialogTitle') });
      if (outcome === 'unavailable') {
        setStatus({ kind: 'error', message: t('exportCsv.screen.cantShare') });
        return;
      }
      const books = t('common.books', { count });
      setStatus({
        kind: 'done',
        message: outcome === 'downloaded' ? t('exportCsv.screen.downloaded', { fileName, books }) : t('exportCsv.screen.ready', { fileName, books }),
      });
    } catch (e) {
      console.error('Could not export the CSV', e);
      setStatus({ kind: 'error', message: t('exportCsv.screen.failed') });
    }
  };

  return (
    <SettingsPage
      title={t('exportCsv.screen.title')}
      intro={t('exportCsv.screen.intro')}
      testID={T.root}
      backTestID={T.back}
    >
      <Card title={t('exportCsv.screen.columnsTitle')} eyebrow={t('exportCsv.screen.columnsEyebrow')}>
        <Text color="inkMuted">{t('exportCsv.screen.columns')}</Text>
      </Card>
      <View style={{ gap: spacing.sm }}>
        <SettingsSwitchRow
          label={t('exportCsv.screen.includeLoans')}
          description={t('exportCsv.screen.includeLoansDescription')}
          value={includeLoans}
          onChange={setIncludeLoans}
          testID={T.includeLoans}
        />
      </View>
      <Button label={t('exportCsv.screen.export')} block loading={status.kind === 'busy'} onPress={() => void run()} testID={T.export} />
      {status.kind === 'done' ? (
        <SettingsNotice tone="success" title={t('exportCsv.screen.savedTitle')} testID={T.status}>
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
