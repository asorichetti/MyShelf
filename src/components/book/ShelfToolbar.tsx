import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, IconButton, Text, type IconName } from '@/components/ui';
import { groupByLabels, viewModeLabels, type ShelfGroupBy, type ShelfSort, type ShelfSortKey, type ShelfViewMode, type SortDirection } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export const sortOptions: { key: ShelfSortKey; label: string; testID: string }[] = [
  { key: 'title', label: 'Title', testID: Testids.home.sortTitle },
  { key: 'author', label: 'Author', testID: Testids.home.sortAuthor },
  { key: 'year', label: 'Year', testID: Testids.home.sortYear },
  { key: 'added', label: 'Recently added', testID: Testids.home.sortAdded },
];

/** The natural first direction for each sort: A-Z, oldest year first, newest addition first, best rated first. */
export const defaultDirection: Record<ShelfSortKey, SortDirection> = { title: 'asc', author: 'asc', year: 'asc', added: 'desc', rating: 'desc' };

export function directionLabel(sort: ShelfSort): string {
  if (sort.sort === 'title' || sort.sort === 'author') return sort.direction === 'asc' ? 'A to Z' : 'Z to A';
  if (sort.sort === 'year') return sort.direction === 'asc' ? 'Oldest first' : 'Newest first';
  return sort.direction === 'desc' ? 'Newest first' : 'Oldest first';
}

export function sortSummary(sort: ShelfSort): string {
  return `${sortOptions.find((o) => o.key === sort.sort)!.label}, ${directionLabel(sort)}`;
}

export const groupByOptions: { key: ShelfGroupBy; testID: string }[] = [
  { key: 'none', testID: Testids.shelfView.groupByNone },
  { key: 'genre', testID: Testids.shelfView.groupByGenre },
  { key: 'series', testID: Testids.shelfView.groupBySeries },
  { key: 'author', testID: Testids.shelfView.groupByAuthor },
  { key: 'group', testID: Testids.shelfView.groupByGroup },
];

export const viewModeOptions: { key: ShelfViewMode; icon: IconName; testID: string }[] = [
  { key: 'list', icon: 'view-agenda-outline', testID: Testids.shelfView.modeList },
  { key: 'covers', icon: 'view-grid-outline', testID: Testids.shelfView.modeCovers },
  { key: 'spines', icon: 'bookshelf', testID: Testids.shelfView.modeSpines },
];

export interface ShelfToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  sort: ShelfSort;
  onSortChange: (sort: ShelfSort) => void;
  /** Group-by menu (shown when `onGroupByChange` is given). */
  groupBy?: ShelfGroupBy;
  onGroupByChange?: (groupBy: ShelfGroupBy) => void;
  /** List / Covers / Spines switch (shown when `onViewModeChange` is given). */
  viewMode?: ShelfViewMode;
  onViewModeChange?: (mode: ShelfViewMode) => void;
  /** Filter button with the number of active filters. */
  filterCount?: number;
  onOpenFilters?: () => void;
  /** "Select" button to start picking books. */
  onSelect?: () => void;
}

/**
 * Above the Shelf list: a search box with a clear button, the display mode
 * switch, and buttons for the sort menu (field and direction), the group-by
 * menu, the filter sheet and selecting books. One menu is open at a time.
 */
export function ShelfToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  groupBy = 'none',
  onGroupByChange,
  viewMode = 'list',
  onViewModeChange,
  filterCount = 0,
  onOpenFilters,
  onSelect,
}: ShelfToolbarProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState<'sort' | 'group' | null>(null);
  const menuOpen = open === 'sort';
  const groupOpen = open === 'group';
  const toggle = (menu: 'sort' | 'group') => setOpen((current) => (current === menu ? null : menu));

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View
          style={[
            styles.search,
            {
              minHeight: sizes.touchTarget,
              borderRadius: radii.pill,
              borderColor: focused ? colors.primary : colors.outline,
              borderWidth: focused ? 2 : 1.5,
              backgroundColor: colors.surface,
              paddingLeft: spacing.md,
            },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={sizes.icon} color={colors.inkMuted} aria-hidden />
          <TextInput
            testID={Testids.home.search}
            role="searchbox"
            accessibilityLabel="Search your shelf"
            aria-label="Search your shelf"
            placeholder="Search title, author or ISBN"
            placeholderTextColor={colors.inkMuted}
            value={query}
            onChangeText={onQueryChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            enterKeyHint="search"
            style={[theme.typography.body, styles.input, { color: colors.ink, paddingHorizontal: spacing.sm, minHeight: sizes.touchTarget - 4 }]}
          />
          {query ? (
            <IconButton icon="close-circle" accessibilityLabel="Clear search" onPress={() => onQueryChange('')} testID={Testids.home.searchClear} />
          ) : null}
        </View>
      </View>
      {onViewModeChange ? (
        <View role="radiogroup" aria-label="Show books as" style={[styles.row, styles.chips, { columnGap: spacing.sm }]}>
          {viewModeOptions.map((o) => (
            <Chip
              key={o.key}
              role="radio"
              label={viewModeLabels[o.key]}
              icon={o.icon}
              selected={viewMode === o.key}
              onPress={() => onViewModeChange(o.key)}
              testID={o.testID}
            />
          ))}
        </View>
      ) : null}
      <View style={[styles.row, styles.sortRow, { columnGap: spacing.xs }]}>
        <Button
          variant="ghost"
          label={`Sort: ${sortSummary(sort)}`}
          accessibilityLabel={`Sort by ${sortSummary(sort)}`}
          icon={<MaterialCommunityIcons name={menuOpen ? 'chevron-up' : 'sort'} size={sizes.icon} color={colors.primary} />}
          onPress={() => toggle('sort')}
          testID={Testids.home.sortButton}
          expanded={menuOpen}
          style={{ paddingHorizontal: spacing.md }}
        />
        {onGroupByChange ? (
          <Button
            variant="ghost"
            label={`Group: ${groupByLabels[groupBy]}`}
            accessibilityLabel={`Group by ${groupByLabels[groupBy]}`}
            icon={<MaterialCommunityIcons name={groupOpen ? 'chevron-up' : 'format-list-group'} size={sizes.icon} color={colors.primary} />}
            onPress={() => toggle('group')}
            testID={Testids.shelfView.groupByButton}
            expanded={groupOpen}
            style={{ paddingHorizontal: spacing.md }}
          />
        ) : null}
        {onOpenFilters ? (
          <Button
            variant="ghost"
            label={filterCount ? `Filter (${filterCount})` : 'Filter'}
            accessibilityLabel={filterCount ? `Filter, ${filterCount} on` : 'Filter'}
            icon={<MaterialCommunityIcons name={filterCount ? 'filter' : 'filter-outline'} size={sizes.icon} color={colors.primary} />}
            onPress={() => {
              setOpen(null);
              onOpenFilters();
            }}
            testID={Testids.shelfView.filterButton}
            style={{ paddingHorizontal: spacing.md }}
          />
        ) : null}
        {onSelect ? (
          <Button
            variant="ghost"
            label="Select"
            accessibilityLabel="Select books"
            icon={<MaterialCommunityIcons name="checkbox-multiple-outline" size={sizes.icon} color={colors.primary} />}
            onPress={() => {
              setOpen(null);
              onSelect();
            }}
            testID={Testids.shelfView.selectButton}
            style={{ paddingHorizontal: spacing.md }}
          />
        ) : null}
      </View>
      {menuOpen ? (
        <View
          role="radiogroup"
          aria-label="Sort by"
          style={[styles.menu, { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceTint }]}
        >
          <Text variant="label" color="inkMuted">
            Sort by
          </Text>
          <View style={[styles.chips, { columnGap: spacing.sm }]}>
            {sortOptions.map((o) => (
              <Chip
                key={o.key}
                label={o.label}
                role="radio"
                selected={sort.sort === o.key}
                testID={o.testID}
                onPress={() => onSortChange({ sort: o.key, direction: o.key === sort.sort ? sort.direction : defaultDirection[o.key] })}
              />
            ))}
          </View>
          <Button
            variant="secondary"
            label={directionLabel(sort)}
            accessibilityLabel={`Order: ${directionLabel(sort)}. Tap to reverse`}
            icon={<MaterialCommunityIcons name="swap-vertical" size={sizes.icon} color={colors.onPrimaryContainer} />}
            onPress={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
            testID={Testids.home.sortDirection}
          />
        </View>
      ) : null}
      {groupOpen && onGroupByChange ? (
        <View
          role="radiogroup"
          aria-label="Group by"
          style={[styles.menu, { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceTint }]}
        >
          <Text variant="label" color="inkMuted">
            Group by
          </Text>
          <View style={[styles.chips, { columnGap: spacing.sm }]}>
            {groupByOptions.map((o) => (
              <Chip key={o.key} label={groupByLabels[o.key]} role="radio" selected={groupBy === o.key} testID={o.testID} onPress={() => onGroupByChange(o.key)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  sortRow: { justifyContent: 'flex-end', flexWrap: 'wrap' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, outlineStyle: 'none' } as object,
  menu: {},
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
