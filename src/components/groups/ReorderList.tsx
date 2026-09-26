import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { IconButton, Text } from '@/components/ui';
import { joinNames, type BookListItem } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { focusWithin } from './focusWithin';

export interface ReorderListProps {
  items: BookListItem[];
  /** Moves the book at `from` to `to` (both in range). */
  onMove: (from: number, to: number) => void;
}


/**
 * A group's books in order, each with "Move up" and "Move down" buttons
 * ("Move Mort up"), so reordering works with a keyboard and a screen reader,
 * not only by dragging. The new position is announced ("Mort moved to 2 of
 * 3"), and focus stays on the button that was used, following the book.
 */
export function ReorderList({ items, onMove }: ReorderListProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const [announcement, setAnnouncement] = useState('');
  const buttons = useRef(new Map<string, unknown>());

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const item = items[index];
    onMove(index, to);
    setAnnouncement(t('groups.reorder.moved', { title: item.title, position: to + 1, total: items.length }));
    // Keep focus with the book; at an end the other button is the useful one.
    const atEnd = to === 0 || to === items.length - 1;
    const key = `${item.id}:${atEnd ? (delta < 0 ? 'down' : 'up') : delta < 0 ? 'up' : 'down'}`;
    requestAnimationFrame(() => focusWithin(buttons.current.get(key)));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text role="status" aria-live="polite" accessibilityLiveRegion="polite" variant="caption" color="inkMuted">
        {announcement || t('groups.reorder.hint')}
      </Text>
      <View role="list" aria-label={t('groups.reorder.listLabel')} style={{ gap: spacing.sm }}>
        {items.map((item, index) => (
          <View
            key={item.id}
            role="listitem"
            testID={Testids.groups.reorderRow}
            aria-label={t('groups.reorder.rowLabel', { index: index + 1, title: item.title })}
            style={[styles.row, { gap: spacing.md, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text variant="mono" color="inkMuted" aria-hidden>
              {index + 1}
            </Text>
            <CoverImage uri={item.coverUri} title={item.title} size="thumb" />
            <View style={styles.text}>
              <Text variant="bodyStrong" numberOfLines={2} style={{ fontFamily: theme.fonts.heading }}>
                {item.title}
              </Text>
              {item.authors.length ? (
                <Text variant="mono" color="inkMuted" numberOfLines={1}>
                  {joinNames(item.authors)}
                </Text>
              ) : null}
            </View>
            <View style={styles.buttons}>
              <View ref={(el) => void buttons.current.set(`${item.id}:up`, el)}>
                <IconButton
                  icon="arrow-up"
                  accessibilityLabel={t('groups.reorder.moveUp', { title: item.title })}
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                  testID={Testids.groups.moveUp}
                />
              </View>
              <View ref={(el) => void buttons.current.set(`${item.id}:down`, el)}>
                <IconButton
                  icon="arrow-down"
                  accessibilityLabel={t('groups.reorder.moveDown', { title: item.title })}
                  disabled={index === items.length - 1}
                  onPress={() => move(index, 1)}
                  testID={Testids.groups.moveDown}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  text: { flex: 1, minWidth: 0 },
  buttons: { flexDirection: 'row' },
});
