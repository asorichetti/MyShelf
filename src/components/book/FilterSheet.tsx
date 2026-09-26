import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Heading, Sheet, TextField } from '@/components/ui';
import {
  activeFilterCount,
  formatLabelKeys,
  loanFilterLabelKeys,
  minRatingLabel,
  noFilters,
  ratingValues,
  RECENTLY_ADDED_DAYS,
  seriesFilterLabelKeys,
  toggleIn,
  type BookFormat,
  type LoanFilter,
  type SeriesFilter,
  type ShelfFilters,
} from '@/domain';
import { t, translate } from '@/i18n';
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
  /** Whether any book has a rating (the rating filter is offered only then, or while it is on). */
  hasRatings?: boolean;
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
  const s = text.trim();
  if (!s) return null;
  return /^\d{1,4}$/.test(s) ? Number(s) : undefined;
}

/**
 * The Shelf's filter sheet: genres (any of), format, language, on loan or at
 * home, in a series or standalone, a year range, a minimum rating ("4 stars
 * and up", once some book is rated) and "added in the last 30 days". Changes apply at once; the chips under the toolbar show what is on.
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
  const yearHint = options.minYear != null && options.maxYear != null ? t('filters.sheet.yearHint', { from: options.minYear, to: options.maxYear }) : undefined;
  const count = activeFilterCount(filters);

  return (
    <Sheet
      visible={visible}
      title={t('filters.sheet.title')}
      subtitle={count ? t('filters.sheet.subtitleCount', { count }) : t('filters.sheet.subtitle')}
      onClose={onClose}
      testID={Testids.shelfView.filterSheet}
      footer={
        <>
          <Button
            variant="ghost"
            label={t('filters.sheet.clearAll')}
            disabled={count === 0}
            onPress={() => {
              setYearFrom('');
              setYearTo('');
              onChange({ ...noFilters, genreIds: [], formats: [], languages: [] });
            }}
          />
          <Button label={t('common.done')} onPress={onClose} testID={Testids.shelfView.filterDone} />
        </>
      }
    >
      {options.genres.length ? (
        <Group title={t('filters.sheet.genres')}>
          {options.genres.map((g) => (
            <Chip
              key={g.id}
              role="checkbox"
              label={t('filters.sheet.genreChip', { name: g.name, count: g.count })}
              accessibilityLabel={t('bookList.nameAndCount', { name: g.name, count: g.count })}
              selected={filters.genreIds.includes(g.id)}
              onPress={() => set({ genreIds: toggleIn(filters.genreIds, g.id) })}
              testID={Testids.shelfView.filterGenre}
            />
          ))}
        </Group>
      ) : null}
      <Group title={t('filters.sheet.onLoan')} role="radiogroup">
        {(Object.keys(loanFilterLabelKeys) as LoanFilter[]).map((key) => (
          <Chip key={key} role="radio" label={translate(loanFilterLabelKeys[key])} selected={filters.loan === key} onPress={() => set({ loan: key })} testID={loanTestIds[key]} />
        ))}
      </Group>
      <Group title={t('filters.sheet.series')} role="radiogroup">
        {(Object.keys(seriesFilterLabelKeys) as SeriesFilter[]).map((key) => (
          <Chip key={key} role="radio" label={translate(seriesFilterLabelKeys[key])} selected={filters.series === key} onPress={() => set({ series: key })} testID={seriesTestIds[key]} />
        ))}
      </Group>
      {options.formats.length ? (
        <Group title={t('filters.sheet.format')}>
          {options.formats.map((f) => (
            <Chip key={f} role="checkbox" label={translate(formatLabelKeys[f])} selected={filters.formats.includes(f)} onPress={() => set({ formats: toggleIn(filters.formats, f) })} testID={Testids.shelfView.filterFormat} />
          ))}
        </Group>
      ) : null}
      {options.languages.length ? (
        <Group title={t('filters.sheet.language')}>
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
        <Heading level={3}>{t('filters.sheet.published')}</Heading>
        <View style={[styles.years, { gap: spacing.md }]}>
          <View style={styles.flex}>
            <TextField
              label={t('filters.sheet.fromYear')}
              value={yearFrom}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(text) => {
                setYearFrom(text);
                const y = parseYear(text);
                if (y !== undefined) set({ yearFrom: y });
              }}
              testID={Testids.shelfView.filterYearFrom}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={t('filters.sheet.toYear')}
              value={yearTo}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(text) => {
                setYearTo(text);
                const y = parseYear(text);
                if (y !== undefined) set({ yearTo: y });
              }}
              helperText={yearHint}
              testID={Testids.shelfView.filterYearTo}
            />
          </View>
        </View>
      </View>
      {options.hasRatings || filters.minRating != null ? (
        <Group title={t('filters.sheet.rating')} role="radiogroup">
          <Chip role="radio" label={t('filters.rating.any')} selected={filters.minRating == null} onPress={() => set({ minRating: null })} testID={Testids.shelfView.filterRatingAny} />
          {[...ratingValues].reverse().map((n) => (
            <Chip
              key={n}
              role="radio"
              icon="star"
              label={minRatingLabel(n)}
              selected={filters.minRating === n}
              onPress={() => set({ minRating: n })}
              testID={Testids.shelfView.filterRating}
            />
          ))}
        </Group>
      ) : null}
      <Group title={t('filters.sheet.added')}>
        <Chip
          role="checkbox"
          label={t('filters.sheet.addedRecently', { count: RECENTLY_ADDED_DAYS })}
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
