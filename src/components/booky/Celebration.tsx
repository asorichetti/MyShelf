import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { hashString } from '@/domain';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme';

import { BookyBubble, type BookyAction } from './BookyBubble';
import { USE_NATIVE_DRIVER as useNativeDriver } from './nativeDriver';

/** How many bookmarks fall, and for how long at most. */
export const CONFETTI_COUNT = 28;
export const CONFETTI_MS = 2600;
/** The shower waits this long, so the reduce-motion preference (read asynchronously) is known first. */
export const CONFETTI_DELAY_MS = 150;

interface Piece {
  x: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  colour: number;
}

/** A stable, pleasant spread of pieces (no Math.random, so tests and screenshots repeat). */
function pieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const h = hashString(`bookmark-${i}`);
    return {
      x: (i + 0.5) / count,
      delay: h % 500,
      duration: CONFETTI_MS - 800 + (h % 800),
      drift: ((h >> 3) % 60) - 30,
      spin: ((h >> 5) % 2 ? 1 : -1) * (180 + ((h >> 7) % 360)),
      colour: (h >> 9) % 97,
    };
  });
}

function Confetti({ onDone, testID }: { onDone: () => void; testID?: string }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [layout] = useState(() => pieces(CONFETTI_COUNT));
  const [progress] = useState(() => layout.map(() => new Animated.Value(0)));
  const colours = [...theme.covers.map((c) => c.cloth), theme.colors.brass, theme.colors.accent, theme.colors.bookyBody];

  useEffect(() => {
    const run = Animated.parallel(
      progress.map((v, i) =>
        Animated.timing(v, { toValue: 1, duration: layout[i].duration, delay: layout[i].delay, easing: Easing.in(Easing.quad), useNativeDriver }),
      ),
    );
    run.start(({ finished }) => finished && onDone());
    return () => run.stop();
  }, [progress, layout, onDone]);

  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[StyleSheet.absoluteFill, styles.noTouch, styles.clip]}
    >
      {layout.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.piece,
            {
              left: p.x * width,
              backgroundColor: colours[p.colour % colours.length],
              borderBottomLeftRadius: theme.radii.none,
              borderTopLeftRadius: theme.radii.sm - 4,
              borderTopRightRadius: theme.radii.sm - 4,
              transform: [
                { translateY: progress[i].interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] }) },
                { translateX: progress[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: progress[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export interface CelebrationProps {
  message: string;
  title?: string;
  onDismiss: () => void;
  actions?: BookyAction[];
  /** Where the bubble sits above the bottom edge. */
  bottom?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  messageTestID?: string;
  dismissTestID?: string;
  confettiTestID?: string;
}

/**
 * A big moment (P04-08, "Series complete!"): Booky, excited, says so in a
 * bubble while a one-time shower of tiny bookmarks falls across the screen.
 * With reduce motion on there is no shower, only the bubble. The bubble text
 * is announced politely; the confetti is hidden from assistive tech and never
 * catches a tap.
 */
export function Celebration({ message, title, onDismiss, actions, bottom, style, testID, messageTestID, dismissTestID, confettiTestID }: CelebrationProps) {
  const { spacing, sizes } = useTheme();
  const reduceMotion = useReducedMotion();
  const [falling, setFalling] = useState<'waiting' | 'falling' | 'done'>('waiting');
  const done = useCallback(() => setFalling('done'), []);
  useEffect(() => {
    const timer = setTimeout(() => setFalling((f) => (f === 'waiting' ? 'falling' : f)), CONFETTI_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, styles.noTouch, style]} testID={testID}>
      {falling === 'falling' && !reduceMotion ? <Confetti onDone={done} testID={confettiTestID} /> : null}
      <View style={[styles.bubble, styles.boxNone, { left: spacing.md, right: spacing.md, bottom: bottom ?? spacing.md, maxWidth: sizes.bubbleMaxWidth }]}>
        <BookyBubble expression="excited" title={title} message={message} actions={actions} onDismiss={onDismiss} messageTestID={messageTestID} dismissTestID={dismissTestID} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noTouch: { pointerEvents: 'box-none' },
  boxNone: { pointerEvents: 'box-none' },
  clip: { overflow: 'hidden', pointerEvents: 'none' },
  piece: { position: 'absolute', top: 0, width: 8, height: 16 },
  bubble: { position: 'absolute', alignSelf: 'center' },
});
