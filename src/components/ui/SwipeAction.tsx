import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme';

import { Text } from './Text';

import type { IconName } from './IconButton';
import type { ReactNode } from 'react';

/** How far (dp) a finger moves sideways before the row follows it, so a vertical scroll is never taken for a swipe. */
const ACTIVATE_DP = 16;
/** How far (dp) up or down a finger may move before the swipe gives way to scrolling. */
const FAIL_DP = 20;
/** A swipe past this share of the row's width does the action on release... */
export const SWIPE_THRESHOLD = 0.35;
/** ...or past this many dp on a wide row (a tablet, the web). */
export const SWIPE_MAX_DP = 120;
/** ...or a quick flick of at least this speed (dp/s) past a touch target's width. */
const FLICK_SPEED = 800;

export interface SwipeActionProps {
  children: ReactNode;
  /** What the swipe does, written on the panel it uncovers ("Mark returned"). */
  label: string;
  icon: IconName;
  /** Called once when the row is swiped far enough to the left and let go. */
  onAction: () => void;
  /** Gesture test id (Jest's `getByGestureTestId`) and the panel's test id. */
  testID?: string;
  /** The panel's test id. */
  panelTestID?: string;
}

/**
 * A row that can be swiped to the left to do one thing, uncovering a panel
 * that says what ("Mark returned"). The swipe is a shortcut only: it calls
 * the same `onAction` as a visible button in the row, which stays, and the
 * row offers the action to screen readers as an accessibility action (see
 * the caller), so nobody needs the gesture. The panel is hidden from
 * accessibility for that reason. A swipe gives way to vertical scrolling;
 * with reduce motion the row jumps back instead of sliding.
 */
export function SwipeAction({ children, label, icon, onAction, testID, panelTestID }: SwipeActionProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(0);
  const offset = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_DP, ACTIVATE_DP])
    .failOffsetY([-FAIL_DP, FAIL_DP])
    .onUpdate((e) => {
      // Only to the left, and never past the row's own width.
      offset.value = Math.max(-width.value, Math.min(0, e.translationX));
    })
    .onEnd((e) => {
      const far = width.value > 0 && -offset.value >= Math.min(width.value * SWIPE_THRESHOLD, SWIPE_MAX_DP);
      const flick = e.velocityX <= -FLICK_SPEED && -offset.value >= sizes.touchTarget;
      offset.value = reduceMotion ? 0 : withTiming(0, { duration: 180 });
      if (far || flick) scheduleOnRN(onAction);
    });
  if (testID) pan.withTestId(testID);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const panelStyle = useAnimatedStyle(() => ({ opacity: offset.value < 0 ? 1 : 0 }));

  return (
    <View onLayout={onLayout}>
      <Animated.View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        testID={panelTestID}
        style={[
          StyleSheet.absoluteFill,
          styles.panel,
          { backgroundColor: colors.success, borderRadius: radii.md, paddingHorizontal: spacing.xl, gap: spacing.sm },
          panelStyle,
        ]}
      >
        <MaterialCommunityIcons name={icon} size={sizes.icon + 4} color={colors.onSuccess} />
        <Text variant="bodyStrong" style={{ color: colors.onSuccess }}>
          {label}
        </Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
});
