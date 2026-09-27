import { useCallback, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CoverImage } from '@/components/book/CoverImage';
import { IconButton, Text } from '@/components/ui';
import { joinNames, type BookListItem } from '@/domain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { focusWithin } from './focusWithin';

export interface ReorderListProps {
  items: BookListItem[];
  /** Moves the book at `from` to `to` (both in range). */
  onMove: (from: number, to: number) => void;
}

/** How long (ms) a finger rests on a row before it can be dragged. */
export const DRAG_HOLD_MS = 350;

/** Where a row sits in the list, from its layout (`top` from the list's top). */
export interface RowBox {
  top: number;
  height: number;
}

/**
 * The index a row dragged from `from` by `dy` would land at: the number of
 * other rows whose middle is above the dragged row's middle.
 */
export function dropIndex(boxes: readonly (RowBox | undefined)[], from: number, dy: number): number {
  'worklet';
  const dragged = boxes[from];
  if (!dragged) return from;
  const middle = dragged.top + dragged.height / 2 + dy;
  let index = 0;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (i !== from && box && box.top + box.height / 2 < middle) index++;
  }
  return index;
}

interface DragState {
  /** The row being dragged, or -1. */
  active: SharedValue<number>;
  /** Where it would land now. */
  hover: SharedValue<number>;
  /** How far it has moved (dp). */
  dy: SharedValue<number>;
  boxes: SharedValue<(RowBox | undefined)[]>;
  gap: number;
}

/**
 * A group's books in order, each with "Move up" and "Move down" buttons
 * ("Move Mort up"), so reordering works with a keyboard and a screen reader.
 * With a finger or a mouse a row can also be held and dragged to its new
 * place while the other rows make room. Either way the new position is
 * announced ("Mort moved to 2 of 3"); after a button, focus stays on the
 * button that was used, following the book.
 */
export function ReorderList({ items, onMove }: ReorderListProps) {
  const theme = useTheme();
  const { spacing } = theme;
  const [announcement, setAnnouncement] = useState('');
  const buttons = useRef(new Map<string, unknown>());
  const reduceMotion = useReducedMotion();
  const active = useSharedValue(-1);
  const hover = useSharedValue(-1);
  const dy = useSharedValue(0);
  const boxes = useSharedValue<(RowBox | undefined)[]>([]);
  const drag: DragState = { active, hover, dy, boxes, gap: spacing.sm };

  const announce = useCallback(
    (item: BookListItem, to: number) => setAnnouncement(t('groups.reorder.moved', { title: item.title, position: to + 1, total: items.length })),
    [items.length],
  );

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const item = items[index];
    onMove(index, to);
    announce(item, to);
    // Keep focus with the book; at an end the other button is the useful one.
    const atEnd = to === 0 || to === items.length - 1;
    const key = `${item.id}:${atEnd ? (delta < 0 ? 'down' : 'up') : delta < 0 ? 'up' : 'down'}`;
    requestAnimationFrame(() => focusWithin(buttons.current.get(key)));
  };

  /** A drag ended: save the move (if any), announce it, and settle every row. */
  const drop = (from: number, to: number) => {
    const item = items[from];
    if (item && to !== from && to >= 0 && to < items.length) {
      onMove(from, to);
      announce(item, to);
    }
    active.value = -1;
    hover.value = -1;
    dy.value = 0;
  };

  const measure = (index: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    const next = boxes.value.slice(0, items.length);
    next[index] = { top: y, height };
    boxes.value = next;
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text role="status" aria-live="polite" accessibilityLiveRegion="polite" variant="caption" color="inkMuted">
        {announcement || t('groups.reorder.hint')}
      </Text>
      <View role="list" aria-label={t('groups.reorder.listLabel')} style={{ gap: spacing.sm }}>
        {items.map((item, index) => (
          <ReorderRow
            key={item.id}
            item={item}
            index={index}
            count={items.length}
            drag={drag}
            reduceMotion={reduceMotion}
            onLayout={measure(index)}
            onDrop={drop}
            onMove={move}
            buttons={buttons}
          />
        ))}
      </View>
    </View>
  );
}

interface ReorderRowProps {
  item: BookListItem;
  index: number;
  count: number;
  drag: DragState;
  reduceMotion: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onDrop: (from: number, to: number) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  buttons: RefObject<Map<string, unknown>>;
}

/** Gesture test id of the row at `index` (Jest's `getByGestureTestId`). */
export const dragTestId = (index: number) => `${Testids.groups.reorderRow}-drag-${index}`;

function ReorderRow({ item, index, count, drag, reduceMotion, onLayout, onDrop, onMove, buttons }: ReorderRowProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const { active, hover, dy, boxes, gap } = drag;

  const pan = Gesture.Pan()
    .activateAfterLongPress(DRAG_HOLD_MS)
    .withTestId(dragTestId(index))
    // Shared values are written with set(): they are this row's props.
    .onStart(() => {
      active.set(index);
      hover.set(index);
      dy.set(0);
    })
    .onUpdate((e) => {
      if (active.get() !== index) return;
      dy.set(e.translationY);
      hover.set(dropIndex(boxes.get(), index, e.translationY));
    })
    .onEnd((_e, success) => {
      // Cancelled (by the system, say): the row goes back where it was.
      if (active.value === index) scheduleOnRN(onDrop, index, success ? hover.value : index);
    });

  const style = useAnimatedStyle(() => {
    const a = active.value;
    if (a === index) {
      return { transform: [{ translateY: dy.value }, { scale: reduceMotion ? 1 : 1.02 }], zIndex: 1, borderColor: colors.primary };
    }
    let shift = 0;
    if (a >= 0) {
      const room = (boxes.value[a]?.height ?? 0) + gap;
      const h = hover.value;
      if (a < index && index <= h) shift = -room;
      else if (h <= index && index < a) shift = room;
    }
    return {
      transform: [{ translateY: reduceMotion || a < 0 ? shift : withTiming(shift, { duration: 150 }) }, { scale: 1 }],
      zIndex: 0,
      borderColor: colors.border,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        role="listitem"
        testID={Testids.groups.reorderRow}
        aria-label={t('groups.reorder.rowLabel', { index: index + 1, title: item.title })}
        onLayout={onLayout}
        style={[styles.row, { gap: spacing.md, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surface }, style]}
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
              onPress={() => onMove(index, -1)}
              testID={Testids.groups.moveUp}
            />
          </View>
          <View ref={(el) => void buttons.current.set(`${item.id}:down`, el)}>
            <IconButton
              icon="arrow-down"
              accessibilityLabel={t('groups.reorder.moveDown', { title: item.title })}
              disabled={index === count - 1}
              onPress={() => onMove(index, 1)}
              testID={Testids.groups.moveDown}
            />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // No text selection while a row is held and dragged with a mouse.
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, userSelect: 'none' },
  text: { flex: 1, minWidth: 0 },
  buttons: { flexDirection: 'row' },
});
