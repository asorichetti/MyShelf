import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { joinNames, type BookListItem } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { bookRowLabel } from './BookRow';
import { CoverImage } from './CoverImage';

/** Splits a list into rows of `size` (the last row may be shorter). */
export function chunk<T>(list: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Selection state shared by the Shelf's three display modes. */
export interface ShelfItemHandlers {
  onPress: (id: number) => void;
  onLongPress?: (id: number) => void;
  /** When set, the Shelf is selecting books and each item is a checkbox. */
  isSelected?: (id: number) => boolean;
}

/** Columns for a covers grid: 3 on phones, more on wider screens (cells at least ~104 wide). */
export function coverColumns(width: number): number {
  return Math.max(3, Math.min(6, Math.floor(width / 120)));
}

export interface CoverGridRowProps extends ShelfItemHandlers {
  items: BookListItem[];
  columns: number;
  /** Width the row can use. */
  width: number;
}

/**
 * One row of the Shelf's "Covers" view: real cover art front and centre (the
 * generated cover only when there is none), with the title underneath. Each
 * cell is a button named like a list row ("Mort, by Terry Pratchett, 1987"),
 * or a checkbox while selecting.
 */
export const CoverGridRow = memo(function CoverGridRow({ items, columns, width, onPress, onLongPress, isSelected }: CoverGridRowProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const gap = spacing.md;
  const cell = Math.floor((width - gap * (columns - 1)) / columns);
  const coverWidth = cell - spacing.sm * 2;
  return (
    <View style={[styles.row, { gap }]}>
      {items.map((item) => {
        const selecting = isSelected != null;
        const checked = isSelected?.(item.id) ?? false;
        return (
          <Pressable
            key={item.id}
            role={selecting ? 'checkbox' : 'button'}
            accessibilityLabel={bookRowLabel(item)}
            aria-label={bookRowLabel(item)}
            {...(selecting ? { 'aria-checked': checked, accessibilityState: { checked } } : {})}
            onPress={() => onPress(item.id)}
            onLongPress={onLongPress ? () => onLongPress(item.id) : undefined}
            testID={Testids.shelfView.coverCell}
            style={({ pressed }) => [
              styles.cell,
              {
                width: cell,
                minHeight: sizes.touchTarget,
                padding: spacing.sm,
                gap: spacing.xs,
                borderRadius: radii.md,
                borderWidth: checked ? 2 : 1,
                borderColor: checked ? colors.primary : 'transparent',
                backgroundColor: checked || pressed ? colors.surfaceTint : 'transparent',
              },
            ]}
          >
            <View>
              <CoverImage uri={item.coverUri} title={item.title} author={joinNames(item.authors)} size="medium" width={coverWidth} />
              {item.onLoan ? (
                <View style={[styles.badge, { backgroundColor: colors.accent, borderRadius: radii.sm, paddingHorizontal: spacing.xs, bottom: spacing.xs, left: spacing.xs }]}>
                  <Text variant="tabLabel" color="onAccent">
                    On loan
                  </Text>
                </View>
              ) : null}
              {selecting ? (
                <View
                  testID={Testids.selection.checkbox}
                  style={[styles.check, { top: spacing.xs, right: spacing.xs, backgroundColor: checked ? colors.primary : colors.surface, borderColor: colors.primary, borderRadius: radii.pill }]}
                >
                  <MaterialCommunityIcons name={checked ? 'check' : 'checkbox-blank-circle-outline'} size={sizes.icon} color={checked ? colors.onPrimary : colors.primary} />
                </View>
              ) : null}
            </View>
            <Text variant="caption" numberOfLines={2} style={{ fontFamily: theme.fonts.heading }}>
              {item.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center' },
  badge: { position: 'absolute' },
  check: { position: 'absolute', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: 2 },
});
