import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
const books = (n: number) => (n === 1 ? '1 book' : `${n} books`);
const rowsWord = (n: number) => (n === 1 ? '1 row' : `${n} rows`);

type Loaded = { name: string; table: CsvTable; existing: Set<string> };

function PreviewRow({ outcome }: { outcome: RowOutcome }) {
  const { colors, spacing, radii, sizes } = useTheme();
  const add = outcome.status === 'add';
  const status = add ? (outcome.notes.length ? `Will be added. ${outcome.notes.join(' ')}` : 'Will be added.') : `Skipped: ${outcome.notes.join(' ')}`;
  const title = outcome.title ?? '(no title)';
  const by = outcome.authors.length ? ` by ${joinNames(outcome.authors)}` : '';
  return (
    <View
      role="listitem"
      accessibilityLabel={`Line ${outcome.line}: ${title}${by}. ${status}`}
      testID={T.previewRow}
      style={[styles.row, { gap: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, backgroundColor: add ? colors.surface : colors.warnContainer }]}
    >
      <MaterialCommunityIcons name={add ? 'check-circle-outline' : 'alert-circle-outline'} size={sizes.icon} color={add ? colors.success : colors.onWarnContainer} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {by ? (
          <Text variant="caption" color="inkMuted" numberOfLines={1}>
            {by.trim()}
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
      if (!table.rows.length) throw new CsvImportError('That file has a header but no books under it.');
      const existing = await existingBookKeys(db);
      setLoaded({ name: file.name, table, existing });
      setPreset(table.preset);
      setMapping(mappingFor(table.headers, table.preset));
      setReport(null);
    } catch (e) {
      if (!(e instanceof CsvImportError)) console.error('Could not read the CSV file', e);
      setError(e instanceof CsvImportError ? e.message : 'Sorry, that file couldn’t be read. Is it a CSV spreadsheet?');
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
      setError('Sorry, the import didn’t work, so nothing was added. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const hasShelves = mapping.some((f) => f === 'shelves' || f === 'exclusiveShelf' || f === 'groups');
  const hasTitle = mapping.includes('title');

  if (report) {
    return (
      <SettingsPage title="Import books from a spreadsheet" testID={T.root} backTestID={T.back}>
        <View style={{ alignItems: 'center' }}>
          <Booky expression="excited" size={96} />
        </View>
        <SettingsNotice tone="success" title={`Imported ${books(report.imported)}`} testID={T.report}>
          {[
            report.groupsCreated.length ? `New groups: ${report.groupsCreated.join(', ')}.` : null,
            report.imported ? 'Covers are being found in the background; they’ll appear on your shelf as they arrive.' : null,
            report.skipped.length ? `${rowsWord(report.skipped.length)} skipped (listed below).` : null,
          ]
            .filter(Boolean)
            .join(' ') || 'Nothing new to add.'}
        </SettingsNotice>
        {report.skipped.length ? (
          <View style={{ gap: spacing.sm }} testID={T.skipped}>
            <Heading level={2}>Skipped rows</Heading>
            <View role="list" aria-label="Skipped rows" style={{ gap: spacing.xs }}>
              {report.skipped.map((s) => (
                <Text key={s.line} role="listitem">{`Line ${s.line}${s.title ? ` (${s.title})` : ''}: ${s.reason}`}</Text>
              ))}
            </View>
          </View>
        ) : null}
        <Button label="See your shelf" block onPress={goToShelf} testID={T.done} />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage
      title="Import books from a spreadsheet"
      intro="Bring in a list of books from a CSV file: a Goodreads export (My Books → Import and export → Export library), a MyShelf spreadsheet, or your own."
      testID={T.root}
      backTestID={T.back}
    >
      <Button label={loaded ? 'Choose a different file' : 'Choose a CSV file'} variant={loaded ? 'secondary' : 'primary'} block loading={reading} onPress={() => void pick()} testID={T.pick} />
      {error ? (
        <SettingsNotice tone="danger" title="That file can’t be imported" testID={T.error}>
          {error}
        </SettingsNotice>
      ) : null}
      {!loaded && !error ? (
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Booky expression="happy" size={88} />
          <Text color="inkMuted" align="center">
            Nothing is added until you’ve seen a preview.
          </Text>
        </View>
      ) : null}

      {loaded && plan ? (
        <View style={{ gap: spacing.lg }}>
          <Card title={loaded.name} eyebrow="Spreadsheet" testID={T.file}>
            <Text>{`${rowsWord(loaded.table.rows.length)} of books, ${loaded.table.headers.length} columns.`}</Text>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <Heading level={2}>Columns</Heading>
            <SelectField
              label="This file is a"
              value={preset}
              options={csvPresets.map((p) => ({ value: p.id, label: p.label }))}
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
            {!hasTitle ? <SettingsNotice tone="warn">Choose which column holds the title: every book needs one.</SettingsNotice> : null}
            {hasShelves ? (
              <CheckboxRow
                label="Turn shelves into groups"
                description="Each shelf (to-read, favourites, …) becomes a MyShelf group holding its books."
                checked={shelvesAsGroups}
                onChange={setShelvesAsGroups}
                testID={T.shelvesToggle}
              />
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }} testID={T.preview}>
            <Heading level={2}>Preview</Heading>
            <Text role="status" aria-live="polite">
              {`${books(plan.books.length)} will be added${plan.skipped.length ? `; ${rowsWord(plan.skipped.length)} will be skipped` : ''}.${loaded.table.rows.length > PREVIEW_ROWS ? ` The first ${PREVIEW_ROWS} rows:` : ''}`}
            </Text>
            <View role="list" aria-label="First rows" style={{ gap: spacing.xs }}>
              {plan.outcomes.slice(0, PREVIEW_ROWS).map((o) => (
                <PreviewRow key={o.line} outcome={o} />
              ))}
            </View>
          </View>

          <Button
            label={plan.books.length ? `Import ${books(plan.books.length)}` : 'Nothing to import'}
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
