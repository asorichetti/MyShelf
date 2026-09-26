import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Text as RNText, Pressable, StyleSheet, View } from 'react-native';

import { hashColour, hashString, type BookListItem } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { artworkTypography, useTheme } from '@/theme';

import { bookRowLabel } from './BookRow';

import type { ShelfItemHandlers } from './CoverGrid';

/** Spine sizes: never narrower than a touch target, height of a shelf. */
export const SPINE_MIN_WIDTH = 48;
export const SPINE_MAX_WIDTH = 60;
export const SPINE_HEIGHT = 184;
const SPINE_GAP = 4;

/** A stable width for a book's spine, so the shelf looks varied but never jumps. */
export function spineWidth(title: string): number {
  return SPINE_MIN_WIDTH + (hashString(`spine:${title}`) % (SPINE_MAX_WIDTH - SPINE_MIN_WIDTH + 1));
}

/** How many spines fit on one shelf of the given width. */
export function spinesPerShelf(width: number): number {
  return Math.max(1, Math.floor((width + SPINE_GAP) / (SPINE_MAX_WIDTH + SPINE_GAP)));
}

export interface SpineShelfProps extends ShelfItemHandlers {
  items: BookListItem[];
}

/**
 * One shelf of the "Spines" view: books standing as cloth spines (colour from
 * a hash of the title, like the generated covers) with the title set in Lora
 * and turned 90°, on a brass shelf edge. A long title is cut short with an
 * ellipsis; the button's name always carries the whole of it.
 */
export const SpineShelf = memo(function SpineShelf({ items, onPress, onLongPress, isSelected }: SpineShelfProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const inset = spacing.md;
  return (
    <View style={{ paddingTop: spacing.sm }}>
      <View style={[styles.row, { gap: SPINE_GAP, paddingHorizontal: spacing.xs }]}>
        {items.map((item) => {
          const cover = theme.covers[hashColour(item.title, theme.covers.length)];
          const width = spineWidth(item.title);
          const length = SPINE_HEIGHT - inset * 2;
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
              testID={Testids.shelfView.spine}
              style={({ pressed }) => [
                styles.spine,
                {
                  width,
                  height: SPINE_HEIGHT,
                  backgroundColor: cover.cloth,
                  borderTopLeftRadius: radii.sm,
                  borderTopRightRadius: radii.sm,
                  borderColor: checked ? colors.primary : cover.trim,
                  borderWidth: checked ? 3 : 0,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View aria-hidden style={[styles.band, { top: spacing.sm, backgroundColor: cover.trim }]} />
              <View aria-hidden style={[styles.band, { bottom: spacing.sm, backgroundColor: cover.trim }]} />
              <View
                aria-hidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.label,
                  { width: length, height: width, left: (width - length) / 2, top: (SPINE_HEIGHT - width) / 2, paddingHorizontal: spacing.xs },
                ]}
              >
                <RNText allowFontScaling={false} numberOfLines={1} ellipsizeMode="tail" style={[artworkTypography.label, { fontFamily: theme.fonts.heading, color: cover.ink }]}>
                  {item.title}
                </RNText>
              </View>
              {selecting ? (
                <View
                  testID={Testids.selection.checkbox}
                  style={[styles.check, { backgroundColor: checked ? colors.primary : colors.surface, borderColor: colors.primary, borderRadius: radii.pill, top: spacing.xxs }]}
                >
                  <MaterialCommunityIcons name={checked ? 'check' : 'checkbox-blank-circle-outline'} size={sizes.icon - 4} color={checked ? colors.onPrimary : colors.primary} />
                </View>
              ) : null}
              {item.onLoan ? <View aria-hidden style={[styles.loan, { backgroundColor: colors.accent, bottom: spacing.lg + spacing.xs }]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View aria-hidden style={[styles.edge, { backgroundColor: colors.brass, borderRadius: radii.sm, boxShadow: theme.elevation.card }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  spine: { overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, height: 2, opacity: 0.8 },
  label: { position: 'absolute', justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-90deg' }] },
  check: { position: 'absolute', alignSelf: 'center', borderWidth: 1.5, padding: 1 },
  loan: { position: 'absolute', left: 0, right: 0, height: 6 },
  edge: { height: 8, alignSelf: 'stretch' },
});
