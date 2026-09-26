import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Heading, Sheet, TextField } from '@/components/ui';
import {
  activeFilterCount,
  formatLabels,
  loanFilterLabels,
  noFilters,
  RECENTLY_ADDED_DAYS,
  seriesFilterLabels,
  toggleIn,
  type BookFormat,
  type LoanFilter,
  type SeriesFilter,
  type ShelfFilters,
} from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import type { ReactNode } from 'react';

/** The values the sheet offers (only ones some book has). */
export interface FilterSheetOptions {
  genres: { id: number; name: string; count: number }[];
  formats: BookFormat[];
  languages: string[];
  minYear: number | null;
  maxYear: number | null;
}

export interface FilterSheetProps {
  visible: boolean;
  filters: ShelfFilters;
  options: FilterSheetOptions;
  onChange: (filters: ShelfFilters) => void;
  onClose: () => void;
  /** English name for a language code. */
  languageName?: (code: string) => string;
}

const loanTestIds: Record<LoanFilter, string> = {
  any: Testids.shelfView.filterLoanAny,
  onLoan: Testids.shelfView.filterLoanOnLoan,
  atHome: Testids.shelfView.filterLoanAtHome,
};
const seriesTestIds: Record<SeriesFilter, string> = {
  any: Testids.shelfView.filterSeriesAny,
  inSeries: Testids.shelfView.filterSeriesIn,
  standalone: Testids.shelfView.filterSeriesStandalone,
};

function Group({ title, children, role }: { title: string; children: ReactNode; role?: 'radiogroup' | 'group' }) {
  const { spacing } = useTheme();
  return (
    <View role={role ?? 'group'} aria-label={title} style={{ gap: spacing.xs }}>
      <Heading level={3}>{title}</Heading>
      <View style={[styles.chips, { columnGap: spacing.sm }]}>{children}</View>
    </View>
  );
}

/** "1987" -> 1987; blank -> null; anything else -> undefined (ignored). */
function parseYear(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  return /^\d{1,4}$/.test(t) ? Number(t) : undefined;
}

/**
 * The Shelf's filter sheet: genres (any of), format, language, on loan or at
 * home, in a series or standalone, a year range and "added in the last 30
 * days". Changes apply at once; the chips under the toolbar show what is on.
 */
export function FilterSheet(props: FilterSheetProps) {
  // Mounted only while open, so the year fields start from the current filters each time.
  return props.visible ? <OpenFilterSheet {...props} /> : null;
}

function OpenFilterSheet({ visible, filters, options, onChange, onClose, languageName = (c) => c }: FilterSheetProps) {
  const { spacing } = useTheme();
  const [yearFrom, setYearFrom] = useState(filters.yearFrom?.toString() ?? '');
  const [yearTo, setYearTo] = useState(filters.yearTo?.toString() ?? '');

  const set = (patch: Partial<ShelfFilters>) => onChange({ ...filters, ...patch });
  const yearHint = options.minYear != null && options.maxYear != null ? `Your books span ${options.minYear}–${options.maxYear}.` : undefined;
  const count = activeFilterCount(filters);

  return (
    <Sheet
      visible={visible}
      title="Filter your shelf"
      subtitle={count ? `${count === 1 ? '1 filter' : `${count} filters`} on` : 'Show only the books you want.'}
      onClose={onClose}
      testID={Testids.shelfView.filterSheet}
      footer={
        <>
          <Button
            variant="ghost"
            label="Clear all"
            disabled={count === 0}
            onPress={() => {
              setYearFrom('');
              setYearTo('');
              onChange({ ...noFilters, genreIds: [], formats: [], languages: [] });
            }}
          />
          <Button label="Done" onPress={onClose} testID={Testids.shelfView.filterDone} />
        </>
      }
    >
      {options.genres.length ? (
        <Group title="Genres">
          {options.genres.map((g) => (
            <Chip
              key={g.id}
              role="checkbox"
              label={`${g.name} (${g.count})`}
              accessibilityLabel={`${g.name}, ${g.count === 1 ? '1 book' : `${g.count} books`}`}
              selected={filters.genreIds.includes(g.id)}
              onPress={() => set({ genreIds: toggleIn(filters.genreIds, g.id) })}
              testID={Testids.shelfView.filterGenre}
            />
          ))}
        </Group>
      ) : null}
      <Group title="On loan" role="radiogroup">
        {(Object.keys(loanFilterLabels) as LoanFilter[]).map((key) => (
          <Chip key={key} role="radio" label={loanFilterLabels[key]} selected={filters.loan === key} onPress={() => set({ loan: key })} testID={loanTestIds[key]} />
        ))}
      </Group>
      <Group title="Series" role="radiogroup">
        {(Object.keys(seriesFilterLabels) as SeriesFilter[]).map((key) => (
          <Chip key={key} role="radio" label={seriesFilterLabels[key]} selected={filters.series === key} onPress={() => set({ series: key })} testID={seriesTestIds[key]} />
        ))}
      </Group>
      {options.formats.length ? (
        <Group title="Format">
          {options.formats.map((f) => (
            <Chip key={f} role="checkbox" label={formatLabels[f]} selected={filters.formats.includes(f)} onPress={() => set({ formats: toggleIn(filters.formats, f) })} testID={Testids.shelfView.filterFormat} />
          ))}
        </Group>
      ) : null}
      {options.languages.length ? (
        <Group title="Language">
          {options.languages.map((code) => (
            <Chip
              key={code}
              role="checkbox"
              label={languageName(code)}
              selected={filters.languages.includes(code)}
              onPress={() => set({ languages: toggleIn(filters.languages, code) })}
              testID={Testids.shelfView.filterLanguage}
            />
          ))}
        </Group>
      ) : null}
      <View style={{ gap: spacing.xs }}>
        <Heading level={3}>Published</Heading>
        <View style={[styles.years, { gap: spacing.md }]}>
          <View style={styles.flex}>
            <TextField
              label="From year"
              value={yearFrom}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(t) => {
                setYearFrom(t);
                const y = parseYear(t);
                if (y !== undefined) set({ yearFrom: y });
              }}
              testID={Testids.shelfView.filterYearFrom}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="To year"
              value={yearTo}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(t) => {
                setYearTo(t);
                const y = parseYear(t);
                if (y !== undefined) set({ yearTo: y });
              }}
              helperText={yearHint}
              testID={Testids.shelfView.filterYearTo}
            />
          </View>
        </View>
      </View>
      <Group title="Added">
        <Chip
          role="checkbox"
          label={`In the last ${RECENTLY_ADDED_DAYS} days`}
          selected={filters.recentlyAdded}
          onPress={() => set({ recentlyAdded: !filters.recentlyAdded })}
          testID={Testids.shelfView.filterRecent}
        />
      </Group>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  years: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 120 },
});
