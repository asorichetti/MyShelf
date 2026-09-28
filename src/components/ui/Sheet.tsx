import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/theme';

import { Heading } from './Heading';
import { keyboardDismissMode } from './keyboardDismiss';
import { useBlockingLayer } from './layers';
import { modalProps, useReturnFocus } from './modalA11y';
import { SHEET_ANIMATION } from './modalAnimation';
import { Scrim } from './Scrim';
import { Text } from './Text';

import type { ReactNode } from 'react';

export interface SheetProps {
  visible: boolean;
  title: string;
  /** Short line under the title. */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons pinned under the scrolling content (e.g. Cancel / Save). */
  footer?: ReactNode;
  /** While true (a save in progress), back, Escape and the scrim do not close it. */
  busy?: boolean;
  testID?: string;
  /** Where focus goes when the sheet closes if the control that opened it has gone (web). */
  returnFocusTo?: () => View | null;
}

/**
 * A bottom sheet over a scrim: a titled dialog whose content scrolls and whose
 * footer stays put. Android back, Escape on web and a tap on the scrim close
 * it; the web Modal traps focus inside and gives it back on close.
 */
export function Sheet({ visible, title, subtitle, onClose, children, footer, busy = false, testID, returnFocusTo }: SheetProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const close = busy ? () => {} : onClose;
  useBlockingLayer(visible);
  useReturnFocus(visible, returnFocusTo);
  return (
    <Modal {...modalProps(title)} visible={visible} transparent animationType={reduceMotion ? 'none' : SHEET_ANIMATION} onRequestClose={close} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <View
          role="dialog"
          aria-modal
          aria-label={title}
          testID={testID}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingTop: spacing.md,
              paddingBottom: spacing.lg + insets.bottom,
              maxWidth: sizes.contentMaxWidth,
              boxShadow: theme.elevation.raised,
            },
          ]}
        >
          <View aria-hidden style={[styles.grabber, { backgroundColor: colors.border, borderRadius: radii.pill, marginBottom: spacing.sm }]} />
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xxs, marginBottom: spacing.sm }}>
            <Heading level={2}>{title}</Heading>
            {subtitle ? <Text color="inkMuted">{subtitle}</Text> : null}
          </View>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md }} keyboardShouldPersistTaps="handled" keyboardDismissMode={keyboardDismissMode}>
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopColor: colors.border }]}>{footer}</View>
          ) : null}
        </View>
        {/* After the sheet in the DOM, so the web focus trap starts inside the sheet. */}
        <Scrim onPress={close} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxHeight: '88%', zIndex: 1 },
  grabber: { width: 40, height: 4, alignSelf: 'center' },
  body: { flexGrow: 0, flexShrink: 1 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth },
});
