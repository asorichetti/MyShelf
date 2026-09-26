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
              paddingRight: onDismiss ? spacing.xxl + spacing.xs : spacing.md,
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
            <Pressable
              role="button"
              accessibilityLabel="Dismiss Booky's tip"
              onPress={onDismiss}
              testID={dismissTestID}
              hitSlop={8}
              style={({ pressed }) => [
                styles.close,
                { borderRadius: radii.pill, backgroundColor: pressed ? colors.surfaceTint : 'transparent' },
              ]}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.inkMuted} />
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
  close: { position: 'absolute', top: 6, right: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
