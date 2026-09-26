import { useId } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { Heading } from './Heading';
import { Text } from './Text';

import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Extra content under the message (e.g. a warning). */
  children?: ReactNode;
  /** Shown above the title (e.g. Booky). */
  illustration?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirmations get the danger button. */
  destructive?: boolean;
  /** Disables both buttons while the confirmed action runs. */
  busy?: boolean;
  onConfirm: () => void;
  /** Also called for Android back, Escape on web and a tap on the backdrop. */
  onCancel: () => void;
  testID?: string;
}

/**
 * A modal confirmation. Cancel comes first so it is the default focus, focus
 * stays inside the dialog while it is open (the web Modal traps it and
 * returns it to the trigger on close), and Android back cancels.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  children,
  illustration,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  testID = Testids.dialog.root,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const reduceMotion = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const titleId = `dialog-title-${id}`;
  const messageId = `dialog-message-${id}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={busy ? () => {} : onCancel}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: colors.scrim, padding: spacing.lg }]}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onCancel}
        />
        <View
          role="alertdialog"
          aria-modal
          aria-labelledby={titleId}
          aria-describedby={message ? messageId : undefined}
          testID={testID}
          style={[
            styles.dialog,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
              padding: spacing.xl,
              gap: spacing.md,
              maxWidth: theme.sizes.bubbleMaxWidth - 120,
              boxShadow: theme.elevation.raised,
            },
          ]}
        >
          {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
          <Heading level={2} nativeID={titleId} align={illustration ? 'center' : undefined}>
            {title}
          </Heading>
          {message ? (
            <Text nativeID={messageId} color="inkMuted" align={illustration ? 'center' : undefined}>
              {message}
            </Text>
          ) : null}
          {children}
          <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.sm }]}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} testID={Testids.dialog.cancel} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={busy}
              testID={Testids.dialog.confirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', borderWidth: 1 },
  illustration: { alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
