import { useState } from 'react';
import { View } from 'react-native';

import { Button, SelectField, Text } from '@/components/ui';
import { t } from '@/i18n';
import { importFieldLabel, importFieldOrder, type ImportField } from '@/services/backup/csvPresets';
import { useTheme } from '@/theme';

export interface ColumnMapperProps {
  headers: readonly string[];
  /** One field per column. */
  mapping: readonly ImportField[];
  /** The first data row, shown as an example under each column. */
  sample: readonly string[] | null;
  onChange: (mapping: ImportField[]) => void;
  testID?: string;
  fieldTestID?: string;
}

const example = (value: string | undefined) => {
  const v = (value ?? '').replace(/^="(.*)"$/s, '$1').replace(/\s+/g, ' ').trim();
  if (!v) return t('importCsv.mapper.emptyExample');
  return t('importCsv.mapper.example', { value: v.length > 60 ? `${v.slice(0, 57)}…` : v });
};

/**
 * Matches each spreadsheet column to a MyShelf field (P08-05). Columns that
 * will be used are listed first; the ignored ones fold away behind a button,
 * so a 24-column Goodreads file stays readable. Choosing a field another
 * column already has moves it: one column per field.
 */
export function ColumnMapper({ headers, mapping, sample, onChange, testID, fieldTestID }: ColumnMapperProps) {
  const { spacing } = useTheme();
  const [showIgnored, setShowIgnored] = useState(false);
  const used = headers.map((_, i) => i).filter((i) => mapping[i] !== 'ignore');
  const ignored = headers.map((_, i) => i).filter((i) => mapping[i] === 'ignore');
  const options = importFieldOrder.map((f) => ({ value: f, label: importFieldLabel(f) }));

  const choose = (index: number, field: ImportField) => {
    const next = mapping.map((f, i) => (i === index ? field : field !== 'ignore' && f === field ? 'ignore' : f));
    onChange(next);
  };

  const field = (i: number) => (
    <SelectField
      key={`${i}-${headers[i]}`}
      label={t('importCsv.mapper.columnLabel', { name: headers[i] || t('importCsv.mapper.columnNumber', { number: i + 1 }) })}
      value={mapping[i]}
      options={options}
      allowNone={false}
      helperText={example(sample?.[i])}
      onChange={(v) => choose(i, v as ImportField)}
      testID={fieldTestID}
    />
  );

  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      {used.length ? used.map(field) : <Text color="inkMuted">{t('importCsv.mapper.noneUsed')}</Text>}
      {ignored.length ? (
        <View style={{ gap: spacing.md }}>
          <Button
            label={showIgnored ? t('importCsv.mapper.hideIgnored') : t('importCsv.mapper.showIgnored', { count: ignored.length })}
            variant="ghost"
            expanded={showIgnored}
            onPress={() => setShowIgnored((v) => !v)}
          />
          {showIgnored ? ignored.map(field) : null}
        </View>
      ) : null}
    </View>
  );
}
