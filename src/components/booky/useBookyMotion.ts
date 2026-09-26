import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { useReducedMotionState } from '@/hooks/useReducedMotion';

import { USE_NATIVE_DRIVER as useNativeDriver } from './nativeDriver';

/** Booky's idle motion (P07-08): a slow bob and an occasional blink. */
export const BOB_MS = 3000;
export const BOB_PX = 2;
export const BLINK_EVERY_MS = 5000;
export const BLINK_MS = 150;

export interface BookyMotion {
  /** Vertical offset for a transform: never layout, so nothing around Booky moves. */
  translateY: Animated.AnimatedInterpolation<number> | 0;
  /** True for the 150 ms of a blink. */
  blinking: boolean;
}

/**
 * Drives Booky's bob (about 2 px over a 3 s loop) and a blink every ~5 s.
 * Nothing is scheduled (no animation, no timer) unless `enabled` and the OS
 * has definitely not asked for reduced motion; the preference is read
 * asynchronously, so an unknown answer counts as "reduce".
 */
export function useBookyMotion(enabled: boolean): BookyMotion {
  const reduced = useReducedMotionState();
  const moving = enabled && reduced === false;
  const [bob] = useState(() => new Animated.Value(0));
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!moving) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: BOB_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: BOB_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    let open: ReturnType<typeof setTimeout> | undefined;
    const blink = setInterval(() => {
      setBlinking(true);
      open = setTimeout(() => setBlinking(false), BLINK_MS);
    }, BLINK_EVERY_MS);
    return () => {
      loop.stop();
      bob.setValue(0);
      clearInterval(blink);
      if (open) clearTimeout(open);
      setBlinking(false);
    };
  }, [bob, moving]);

  return { translateY: moving ? bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_PX] }) : 0, blinking: moving && blinking };
}
