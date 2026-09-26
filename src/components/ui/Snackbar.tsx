import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useBottomObstacle } from './layers';
import { Text } from './Text';

export interface SnackbarAction {
  label: string;
  onPress: () => void;
}

export interface SnackbarProps {
  message: string;
  action?: SnackbarAction;
  /** Called when the action is focused or blurred, so a host can pause its timer. */
  onFocusChange?: (focused: boolean) => void;
  /**
   * Be its own polite live region (default). `SnackbarHost` turns this off
   * and is the live region itself, since a region that appears already
   * holding its message is often not read out.
   */
  live?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A short message on a dark strip, with an optional action such as Undo. Announced politely. */
export function Snackbar({ message, action, onFocusChange, live = true, testID = Testids.snackbar.root, style }: SnackbarProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  return (
    <View
      testID={testID}
      {...(live ? { role: 'status' as const, 'aria-live': 'polite' as const, accessibilityLiveRegion: 'polite' as const } : {})}
      style={[
        styles.bar,
        {
          backgroundColor: colors.inverseSurface,
          borderRadius: radii.md,
          paddingLeft: spacing.lg,
          paddingRight: action ? spacing.xs : spacing.lg,
          minHeight: sizes.touchTarget + spacing.sm,
          gap: spacing.sm,
          boxShadow: theme.elevation.raised,
          maxWidth: sizes.bubbleMaxWidth,
        },
        style,
      ]}
    >
      <Text color="onInverseSurface" style={[styles.message, { paddingVertical: spacing.sm }]}>
        {message}
      </Text>
      {action ? (
        <Pressable
          role="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          testID={Testids.snackbar.action}
          style={({ pressed }) => [
            styles.action,
            {
              minHeight: sizes.touchTarget,
              minWidth: sizes.touchTarget,
              paddingHorizontal: spacing.md,
              borderRadius: radii.sm,
              backgroundColor: pressed ? colors.onPrimaryContainer : 'transparent',
            },
          ]}
        >
          <Text variant="bodyStrong" color="inversePrimary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface SnackbarOptions {
  message: string;
  action?: SnackbarAction;
  /** Auto-hide delay in ms. Defaults to 4 s, or 6 s when there is an action. */
  duration?: number;
  /**
   * Called once when this snackbar goes away: `action` (its action ran),
   * `timeout`, `replaced` (another snackbar took its place) or `dismissed`.
   * Use it to finish work the action could still have undone.
   */
  onHide?: (reason: SnackbarHideReason) => void;
}

export type SnackbarHideReason = 'action' | 'timeout' | 'replaced' | 'dismissed';

interface ShownSnack extends SnackbarOptions {
  id: number;
}

interface SnackbarContextValue {
  snack: ShownSnack | null;
  show: (options: SnackbarOptions) => void;
  dismiss: (reason?: SnackbarHideReason) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export const SNACKBAR_DURATION = 4000;
export const SNACKBAR_ACTION_DURATION = 6000;

/** Holds the current snackbar so it survives navigation (e.g. Undo after leaving a deleted book). */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<ShownSnack | null>(null);
  const nextId = useRef(1);
  const current = useRef<ShownSnack | null>(null);
  const replace = useCallback((next: ShownSnack | null, reason: SnackbarHideReason) => {
    const previous = current.current;
    current.current = next;
    setSnack(next);
    previous?.onHide?.(reason);
  }, []);
  const show = useCallback((options: SnackbarOptions) => replace({ ...options, id: nextId.current++ }, 'replaced'), [replace]);
  const dismiss = useCallback((reason: SnackbarHideReason = 'dismissed') => replace(null, reason), [replace]);
  const value = useMemo(() => ({ snack, show, dismiss }), [snack, show, dismiss]);
  return <SnackbarContext.Provider value={value}>{children}</SnackbarContext.Provider>;
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used inside a SnackbarProvider');
  return ctx;
}

/**
 * Renders the current snackbar at the bottom of its parent and hides it after
 * its duration. The timer pauses while the action has keyboard focus.
 */
export function SnackbarHost({ style }: { style?: StyleProp<ViewStyle> }) {
  const { snack, dismiss } = useSnackbar();
  const { spacing } = useTheme();
  // Which snackbar (by id) is paused, so a new one never inherits the pause.
  const [pausedId, setPausedId] = useState<number | null>(null);
  const paused = snack != null && pausedId === snack.id;
  // Booky's tips step out of the snackbar's way (P07-07).
  const { attach: attachObstacle, onLayout: layoutObstacle } = useBottomObstacle(snack != null);

  useEffect(() => {
    if (!snack || paused) return;
    const ms = snack.duration ?? (snack.action ? SNACKBAR_ACTION_DURATION : SNACKBAR_DURATION);
    const timer = setTimeout(() => dismiss('timeout'), ms);
    return () => clearTimeout(timer);
  }, [snack, paused, dismiss]);

  const action = snack?.action && {
    label: snack.action.label,
    onPress: () => {
      dismiss('action');
      snack.action!.onPress();
    },
  };
  // The host is always there as an empty live region, so each message is read out as it arrives.
  return (
    <View
      ref={attachObstacle}
      onLayout={layoutObstacle}
      role="status"
      aria-live="polite"
      accessibilityLiveRegion="polite"
      style={[styles.host, { left: spacing.md, right: spacing.md, bottom: spacing.md }, style]}
    >
      {snack ? (
        <Snackbar key={snack.id} live={false} message={snack.message} action={action ?? undefined} onFocusChange={(focused) => setPausedId(focused ? snack.id : null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', width: '100%', alignSelf: 'center' },
  message: { flex: 1 },
  action: { alignItems: 'center', justifyContent: 'center' },
  host: { position: 'absolute', alignItems: 'center', pointerEvents: 'box-none' },
});
