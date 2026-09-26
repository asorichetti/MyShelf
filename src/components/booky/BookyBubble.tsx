import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Text, type ButtonVariant } from '@/components/ui';
import { useReducedMotionState } from '@/hooks/useReducedMotion';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Booky } from './Booky';
import { useBookyMode } from './BookyProvider';
import { USE_NATIVE_DRIVER as useNativeDriver } from './nativeDriver';

import type { BookyExpression } from './expressions';

export interface BookyAction {
  label: string;
  onPress: () => void;
  testID?: string;
  /** Default: the first action is secondary, the rest ghost. */
  variant?: ButtonVariant;
}

export interface BookyBubbleProps {
  message: string;
  title?: string;
  expression?: BookyExpression;
  actions?: BookyAction[];
  /** Shows a close button when provided. */
  onDismiss?: () => void;
  showAvatar?: boolean;
  testID?: string;
  messageTestID?: string;
  dismissTestID?: string;
  avatarTestID?: string;
  /** Pop in (a 150 ms fade and 6 px rise) when it appears; skipped with reduced motion. */
  pop?: boolean;
  /**
   * Compact (large text, short windows): a small Booky beside the words
   * inside the bubble instead of a big one beside it, and no tail, so the
   * words get the width and the bubble stays as short as it can.
   */
  compact?: boolean;
  /**
   * The tallest the bubble may get; longer words scroll inside it, with ✕
   * always in reach. Used with `compact`, so a tip at large text never takes
   * more than half the screen.
   */
  maxHeight?: number;
  /**
   * Announce the text politely (default). Booky's floating tips pass false:
   * the overlay announces them once through its own live region.
   */
  live?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Booky's size inside a compact bubble. */
const COMPACT_AVATAR = 32;

/** The bubble's pop-in (P07-08). */
export const POP_MS = 150;

/** 0 -> 1 over POP_MS once mounted, only when reduced motion is definitely off; otherwise 1 from the start. */
function usePop(enabled: boolean): Animated.Value | null {
  const reduced = useReducedMotionState();
  const [progress] = useState(() => (enabled && reduced === false ? new Animated.Value(0) : null));
  useEffect(() => {
    if (!progress) return;
    const run = Animated.timing(progress, { toValue: 1, duration: POP_MS, easing: Easing.out(Easing.quad), useNativeDriver });
    run.start();
    return () => run.stop();
  }, [progress]);
  return progress;
}

/** Booky with a speech bubble. The text is announced politely by screen readers. */
export function BookyBubble({
  message,
  title,
  expression = 'happy',
  actions,
  onDismiss,
  showAvatar = true,
  testID,
  messageTestID,
  dismissTestID,
  avatarTestID,
  pop = false,
  compact = false,
  maxHeight,
  live = true,
  style,
}: BookyBubbleProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  // Off: Booky's words still show where they matter (a lookup found nothing), without the character.
  const mode = useBookyMode();
  const withAvatar = showAvatar && mode !== 'off';
  const beside = withAvatar && !compact;
  const inside = withAvatar && compact;
  const popping = usePop(pop);
  const motion = popping
    ? // Fade and rise rather than scale: a scaled bubble would briefly shrink its buttons below 48 dp.
      { opacity: popping, transform: [{ translateY: popping.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }
    : null;
  // Room on the right for ✕ (it stays put when the words scroll): beside every line, or in compact only beside the first.
  const closeRoom = onDismiss ? theme.sizes.touchTarget - spacing.md : 0;
  const pad = { padding: spacing.md, paddingRight: spacing.md + (inside ? 0 : closeRoom) };
  const avatar = <Booky expression={expression} size={COMPACT_AVATAR} testID={avatarTestID} />;
  const titleText = title ? (
    <Text variant="bodyStrong" color="primary">
      {title}
    </Text>
  ) : null;
  const messageText = <Text testID={messageTestID}>{message}</Text>;
  const actionRow = actions?.length ? (
    <View style={[styles.actions, { gap: spacing.sm }]}>
      {actions.map((a, i) => (
        <Button
          key={a.label}
          label={a.label}
          onPress={a.onPress}
          testID={a.testID}
          variant={a.variant ?? (i === 0 ? 'secondary' : 'ghost')}
        />
      ))}
    </View>
  ) : null;
  // Compact: a small Booky leads the title, or else the buttons, or else the words; everything else takes the full width.
  const lead = !inside ? null : title ? 'title' : actionRow ? 'actions' : 'message';
  const withLead = (node: ReactNode, style?: StyleProp<ViewStyle>) => (
    <View style={[styles.lead, { gap: spacing.sm }, style]}>
      {avatar}
      <View style={styles.leadRest}>{node}</View>
    </View>
  );
  const body = (
    <>
      {lead === 'title' ? withLead(titleText, { marginRight: closeRoom }) : titleText}
      {lead === 'message' ? withLead(messageText, { marginRight: closeRoom }) : lead === 'actions' ? <View style={{ marginRight: closeRoom }}>{messageText}</View> : messageText}
      {actionRow ? <View style={{ marginTop: spacing.xs }}>{lead === 'actions' ? withLead(actionRow) : actionRow}</View> : null}
    </>
  );
  return (
    <Animated.View testID={testID} style={[styles.row, { gap: spacing.sm }, motion, style]}>
      {beside ? <Booky expression={expression} size={56} testID={avatarTestID} /> : null}
      <View style={styles.bubbleWrap}>
        {beside ? (
          <View
            aria-hidden
            style={[styles.tail, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          />
        ) : null}
        <View
          aria-live={live ? 'polite' : undefined}
          accessibilityLiveRegion={live ? 'polite' : undefined}
          style={[
            styles.bubble,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderRadius: radii.lg,
              boxShadow: theme.elevation.raised,
            },
            maxHeight != null ? { maxHeight, overflow: 'hidden' } : [pad, { gap: spacing.xs }],
          ]}
        >
          {maxHeight != null ? (
            <ScrollView style={styles.scroll} contentContainerStyle={[pad, { gap: spacing.xs }]}>
              {body}
            </ScrollView>
          ) : (
            body
          )}
          {onDismiss ? (
            // The hit area is a full touch target; only the circle inside it is
            // drawn at the smaller icon-button size. (react-native-web ignores
            // hitSlop, so the box itself must be big enough.)
            <Pressable
              role="button"
              accessibilityLabel={t('booky.bubble.dismiss')}
              onPress={onDismiss}
              testID={dismissTestID}
              style={[styles.close, { width: theme.sizes.touchTarget, height: theme.sizes.touchTarget }]}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.closeCircle,
                    {
                      width: theme.sizes.iconButton,
                      height: theme.sizes.iconButton,
                      borderRadius: radii.pill,
                      backgroundColor: pressed ? colors.surfaceTint : 'transparent',
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="close" size={theme.sizes.icon} color={colors.inkMuted} />
                </View>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  bubbleWrap: { flex: 1, flexShrink: 1 },
  bubble: { borderWidth: 1.5 },
  tail: {
    position: 'absolute',
    left: -6,
    bottom: 18,
    width: 14,
    height: 14,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  lead: { flexDirection: 'row', alignItems: 'center' },
  leadRest: { flex: 1, flexShrink: 1 },
  scroll: { flexShrink: 1 },
  close: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  closeCircle: { alignItems: 'center', justifyContent: 'center' },
});
