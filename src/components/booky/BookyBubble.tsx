import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { Booky } from './Booky';

import type { BookyExpression } from './expressions';

export interface BookyAction {
  label: string;
  onPress: () => void;
  testID?: string;
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
  style?: StyleProp<ViewStyle>;
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
  style,
}: BookyBubbleProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  return (
    <View testID={testID} style={[styles.row, { gap: spacing.sm }, style]}>
      {showAvatar ? <Booky expression={expression} size={56} testID={avatarTestID} /> : null}
      <View style={styles.bubbleWrap}>
        {showAvatar ? (
          <View
            aria-hidden
            style={[styles.tail, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          />
        ) : null}
        <View
          aria-live="polite"
          accessibilityLiveRegion="polite"
          style={[
            styles.bubble,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderRadius: radii.lg,
              padding: spacing.md,
              paddingRight: onDismiss ? theme.sizes.touchTarget : spacing.md,
              gap: spacing.xs,
              boxShadow: theme.elevation.raised,
            },
          ]}
        >
          {title ? (
            <Text variant="bodyStrong" color="primary">
              {title}
            </Text>
          ) : null}
          <Text testID={messageTestID}>{message}</Text>
          {actions?.length ? (
            <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.xs }]}>
              {actions.map((a, i) => (
                <Button
                  key={a.label}
                  label={a.label}
                  onPress={a.onPress}
                  testID={a.testID}
                  variant={i === 0 ? 'secondary' : 'ghost'}
                />
              ))}
            </View>
          ) : null}
          {onDismiss ? (
            // The hit area is a full touch target; only the circle inside it is
            // drawn at the smaller icon-button size. (react-native-web ignores
            // hitSlop, so the box itself must be big enough.)
            <Pressable
              role="button"
              accessibilityLabel="Dismiss Booky's tip"
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
    </View>
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
  close: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  closeCircle: { alignItems: 'center', justifyContent: 'center' },
});
