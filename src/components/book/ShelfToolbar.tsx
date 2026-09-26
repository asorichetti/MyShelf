import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, IconButton, Text } from '@/components/ui';
import type { ShelfSort, ShelfSortKey, SortDirection } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export const sortOptions: { key: ShelfSortKey; label: string; testID: string }[] = [
  { key: 'title', label: 'Title', testID: Testids.home.sortTitle },
  { key: 'author', label: 'Author', testID: Testids.home.sortAuthor },
  { key: 'year', label: 'Year', testID: Testids.home.sortYear },
  { key: 'added', label: 'Recently added', testID: Testids.home.sortAdded },
];

/** The natural first direction for each sort: A-Z, oldest year first, newest addition first. */
export const defaultDirection: Record<ShelfSortKey, SortDirection> = { title: 'asc', author: 'asc', year: 'asc', added: 'desc' };

export function directionLabel(sort: ShelfSort): string {
  if (sort.sort === 'title' || sort.sort === 'author') return sort.direction === 'asc' ? 'A to Z' : 'Z to A';
  if (sort.sort === 'year') return sort.direction === 'asc' ? 'Oldest first' : 'Newest first';
  return sort.direction === 'desc' ? 'Newest first' : 'Oldest first';
}

export function sortSummary(sort: ShelfSort): string {
  return `${sortOptions.find((o) => o.key === sort.sort)!.label}, ${directionLabel(sort)}`;
}

export interface ShelfToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  sort: ShelfSort;
  onSortChange: (sort: ShelfSort) => void;
}

/** Search box with a clear button, and a sort menu (field and direction) above the Shelf list. */
export function ShelfToolbar({ query, onQueryChange, sort, onSortChange }: ShelfToolbarProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      <View style={[styles.row, styles.sortRow, { gap: spacing.sm }]}>
        <Button
          variant="ghost"
          label={`Sort: ${sortSummary(sort)}`}
          accessibilityLabel={`Sort by ${sortSummary(sort)}`}
          icon={<MaterialCommunityIcons name={menuOpen ? 'chevron-up' : 'sort'} size={sizes.icon} color={colors.primary} />}
          onPress={() => setMenuOpen((open) => !open)}
          testID={Testids.home.sortButton}
          expanded={menuOpen}
          style={{ paddingHorizontal: spacing.md }}
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  sortRow: { justifyContent: 'flex-end' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, outlineStyle: 'none' } as object,
  menu: {},
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
