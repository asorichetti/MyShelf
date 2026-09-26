import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme';


export interface ViewfinderProps {
  /** What to aim at, e.g. "Line up the barcode on the back cover". */
  hint: string;
  /** The scanning line moves only while scanning (and never with reduce motion). */
  active: boolean;
}

/**
 * The camera overlay (P03-03): a library-card frame with a punched hole and
 * a sweeping scan line. Decorative: the hint is also the camera's label.
 */
export function Viewfinder({ hint, active }: ViewfinderProps) {
  const { colors, spacing, radii } = useTheme();
  const reduceMotion = useReducedMotion();
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active || reduceMotion) {
      sweep.setValue(0.5);
      return;
    }
    // `top` is a layout property, so this runs on the JS thread (a thin line, cheap to move).
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(sweep, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, sweep]);

  const top = sweep.interpolate({ inputRange: [0, 1], outputRange: ['12%', '84%'] });
  return (
    <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, styles.center]}>
      <View style={[styles.card, { borderColor: colors.surface, borderRadius: radii.md }]}>
        <View style={[styles.rule, { backgroundColor: colors.cardRule }]} />
        <Animated.View style={[styles.line, { top, backgroundColor: colors.accent }]} />
        <View style={[styles.hole, { borderColor: colors.surface }]} />
      </View>
      <Text variant="label" style={{ color: colors.onInverseSurface, marginTop: spacing.md, backgroundColor: colors.scrim, paddingHorizontal: spacing.sm, borderRadius: radii.sm }}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { width: '78%', aspectRatio: 1.6, borderWidth: 3, overflow: 'hidden' },
  rule: { position: 'absolute', top: '10%', left: 0, right: 0, height: 2 },
  line: { position: 'absolute', left: '6%', right: '6%', height: 2 },
  hole: { position: 'absolute', bottom: 8, alignSelf: 'center', width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
