import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Booky } from '@/components/booky';
import { ColumnMapper } from '@/components/settings/ColumnMapper';
import { CheckboxRow, SettingsNotice } from '@/components/settings/SettingsControls';
import { Button, Card, Heading, SelectField, Text } from '@/components/ui';
import { useDatabase } from '@/db';
import { joinNames } from '@/domain';
import { drainCoverBackfill } from '@/features/covers';
import { emit } from '@/features/events';
import { t, translate } from '@/i18n';
import {
  csvPresets,
  CsvImportError,
  CSV_MIME,
  existingBookKeys,
  importPlannedBooks,
  mappingFor,
  planImport,
  readCsvTable,
  type CsvTable,
  type ImportField,
  type ImportReport,
  type PresetId,
  type RowOutcome,
} from '@/services/backup';
import { pickTextFile } from '@/services/backup/pickFile';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { goToShelf } from './goToShelf';
import { announceLibraryReplaced } from './libraryEvents';
import { SettingsPage } from './SettingsPage';

const T = Testids.csvImport;
const PREVIEW_ROWS = 10;
const books = (count: number) => t('common.books', { count });
const rowsWord = (count: number) => t('importCsv.rows', { count });

type Loaded = { name: string; table: CsvTable; existing: Set<string> };

function PreviewRow({ outcome }: { outcome: RowOutcome }) {
  const { colors, spacing, radii, sizes } = useTheme();
  const add = outcome.status === 'add';
  const notes = outcome.notes.join(t('backup.sentenceSeparator'));
  const status = add ? (outcome.notes.length ? t('importCsv.preview.willBeAddedWithNotes', { notes }) : t('importCsv.preview.willBeAdded')) : t('importCsv.preview.skipped', { notes });
  const title = outcome.title ?? t('importCsv.preview.noTitle');
  const names = outcome.authors.length ? joinNames(outcome.authors) : null;
  const label =
    names != null
      ? t('importCsv.preview.rowLabelWithAuthors', { line: outcome.line, title, names, status })
      : t('importCsv.preview.rowLabel', { line: outcome.line, title, status });
  return (
    <View
      role="listitem"
      accessibilityLabel={label}
      testID={T.previewRow}
      style={[styles.row, { gap: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, backgroundColor: add ? colors.surface : colors.warnContainer }]}
    >
      <MaterialCommunityIcons name={add ? 'check-circle-outline' : 'alert-circle-outline'} size={sizes.icon} color={add ? colors.success : colors.onWarnContainer} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {names != null ? (
          <Text variant="caption" color="inkMuted" numberOfLines={1}>
            {t('importCsv.preview.byAuthors', { names })}
          </Text>
        ) : null}
        <Text variant="caption" color={add ? 'inkMuted' : 'onWarnContainer'}>
          {status}
        </Text>
      </View>
    </View>
  );
}

/**
 * Settings → Import books from a spreadsheet (P08-05): choose a CSV file,
 * check the preset (Goodreads is recognised by its columns) and the column
 * mapping, see the first rows as they will be imported, then import in one
 * go. Rows that cannot be imported are listed with the reason; real covers
 * for the new books are fetched afterwards, in the background.
 */
export function ImportCsvScreen() {
  const db = useDatabase();
  const { spacing } = useTheme();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [preset, setPreset] = useState<PresetId>('custom');
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [shelvesAsGroups, setShelvesAsGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const plan = useMemo(
    () => (loaded ? planImport(loaded.table.rows, mapping, { shelvesAsGroups, existing: loaded.existing }) : null),
    [loaded, mapping, shelvesAsGroups],
  );

  const pick = async () => {
    setReading(true);
    setError(null);
    try {
      const file = await pickTextFile([CSV_MIME, '.csv', 'text/comma-separated-values', 'text/plain']);
      if (!file) return;
      const table = readCsvTable(file.text);
      if (!table.rows.length) throw new CsvImportError(t('importCsv.errors.noRows'));
      const existing = await existingBookKeys(db);
      setLoaded({ name: file.name, table, existing });
      setPreset(table.preset);
      setMapping(mappingFor(table.headers, table.preset));
      setReport(null);
    } catch (e) {
      if (!(e instanceof CsvImportError)) console.error('Could not read the CSV file', e);
      setError(e instanceof CsvImportError ? e.message : t('importCsv.errors.unreadable'));
    } finally {
      setReading(false);
    }
  };

  const run = async () => {
    if (!plan) return;
    setImporting(true);
    try {
      const result = await importPlannedBooks(db, plan);
      setReport(result);
      announceLibraryReplaced();
      // Real covers for the new books, found through the cover backfill without holding up the import.
      void drainCoverBackfill(db, { onAttached: () => emit('library-changed') });
    } catch (e) {
      console.error('Could not import the CSV', e);
      setError(t('importCsv.errors.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const hasShelves = mapping.some((f) => f === 'shelves' || f === 'exclusiveShelf' || f === 'groups');
  const hasTitle = mapping.includes('title');

  if (report) {
    return (
      <SettingsPage title={t('importCsv.screen.title')} testID={T.root} backTestID={T.back}>
        <View style={{ alignItems: 'center' }}>
          <Booky expression="excited" size={96} />
        </View>
        <SettingsNotice tone="success" title={t('importCsv.report.title', { count: report.imported })} testID={T.report} focusOnShow>
          {[
            report.groupsCreated.length ? t('importCsv.report.newGroups', { names: report.groupsCreated.join(t('common.list.separator')) }) : null,
            report.imported ? t('importCsv.report.coversComing') : null,
            report.skipped.length ? t('importCsv.report.skipped', { count: report.skipped.length }) : null,
          ]
            .filter(Boolean)
            .join(t('backup.sentenceSeparator')) || t('importCsv.report.nothingNew')}
        </SettingsNotice>
        {report.skipped.length ? (
          <View style={{ gap: spacing.sm }} testID={T.skipped}>
            <Heading level={2}>{t('importCsv.report.skippedHeading')}</Heading>
            <View role="list" aria-label={t('importCsv.report.skippedHeading')} style={{ gap: spacing.xs }}>
              {report.skipped.map((s) => (
                <Text key={s.line} role="listitem">{s.title ? t('importCsv.report.skippedLineWithTitle', { line: s.line, title: s.title, reason: s.reason }) : t('importCsv.report.skippedLine', { line: s.line, reason: s.reason })}</Text>
              ))}
            </View>
          </View>
        ) : null}
        {report.imported ? (
          <View style={{ gap: spacing.sm }}>
            <Text color="inkMuted">{t('importCsv.report.fetchDetailsHint')}</Text>
            <Button
              label={t('importCsv.report.fetchDetails')}
              variant="secondary"
              block
              onPress={() => router.push({ pathname: '/settings/fetch-details', params: { ids: report.bookIds.join(',') } })}
              testID={T.fetchDetails}
            />
          </View>
        ) : null}
        <Button label={t('importCsv.report.seeShelf')} block onPress={goToShelf} testID={T.done} />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title={t('importCsv.screen.title')}
      intro={t('importCsv.screen.intro')}
      testID={T.root}
      backTestID={T.back}
    >
      <Button label={loaded ? t('importCsv.screen.chooseDifferentFile') : t('importCsv.screen.chooseFile')} variant={loaded ? 'secondary' : 'primary'} block loading={reading} onPress={() => void pick()} testID={T.pick} />
      {error ? (
        <SettingsNotice tone="danger" title={t('importCsv.screen.errorTitle')} testID={T.error}>
          {error}
        </SettingsNotice>
      ) : null}
      {!loaded && !error ? (
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Booky expression="happy" size={88} />
          <Text color="inkMuted" align="center">
            {t('importCsv.screen.previewFirst')}
          </Text>
        </View>
      ) : null}

      {loaded && plan ? (
        <View style={{ gap: spacing.lg }}>
          <Card title={loaded.name} eyebrow={t('importCsv.file.eyebrow')} testID={T.file}>
            <Text>{t('importCsv.file.summary', { rows: rowsWord(loaded.table.rows.length), columns: t('importCsv.file.columnCount', { count: loaded.table.headers.length }) })}</Text>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <Heading level={2}>{t('importCsv.columns.heading')}</Heading>
            <SelectField
              label={t('importCsv.columns.presetLabel')}
              value={preset}
              options={csvPresets.map((p) => ({ value: p.id, label: translate(p.labelKey) }))}
              allowNone={false}
              onChange={(v) => {
                setPreset(v as PresetId);
                setMapping(mappingFor(loaded.table.headers, v as PresetId));
              }}
              testID={T.preset}
            />
            <ColumnMapper
              headers={loaded.table.headers}
              mapping={mapping}
              sample={loaded.table.rows[0] ?? null}
              onChange={(m) => {
                setMapping(m);
                setPreset('custom');
              }}
              testID={T.mapping}
              fieldTestID={T.mapField}
            />
            {!hasTitle ? <SettingsNotice tone="warn">{t('importCsv.columns.needsTitle')}</SettingsNotice> : null}
            {hasShelves ? (
              <CheckboxRow
                label={t('importCsv.columns.shelvesAsGroups')}
                description={t('importCsv.columns.shelvesAsGroupsDescription')}
                checked={shelvesAsGroups}
                onChange={setShelvesAsGroups}
                testID={T.shelvesToggle}
              />
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }} testID={T.preview}>
            <Heading level={2}>{t('importCsv.preview.heading')}</Heading>
            <Text role="status" aria-live="polite">
              {importing
                ? t('importCsv.preview.importing', { count: plan.books.length })
                : [
                    plan.skipped.length
                      ? t('importCsv.preview.willAddAndSkip', { books: books(plan.books.length), rows: rowsWord(plan.skipped.length) })
                      : t('importCsv.preview.willAdd', { books: books(plan.books.length) }),
                    loaded.table.rows.length > PREVIEW_ROWS ? t('importCsv.preview.firstRows', { count: PREVIEW_ROWS }) : null,
                  ]
                    .filter(Boolean)
                    .join(t('backup.sentenceSeparator'))}
            </Text>
            <View role="list" aria-label={t('importCsv.preview.listLabel')} style={{ gap: spacing.xs }}>
              {plan.outcomes.slice(0, PREVIEW_ROWS).map((o) => (
                <PreviewRow key={o.line} outcome={o} />
              ))}
            </View>
          </View>

          <Button
            label={plan.books.length ? t('importCsv.confirm.import', { count: plan.books.length }) : t('importCsv.confirm.nothing')}
            block
            disabled={!plan.books.length}
            loading={importing}
            onPress={() => void run()}
            testID={T.confirm}
          />
        </View>
      ) : null}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
});
