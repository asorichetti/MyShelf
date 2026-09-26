import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { IconButton } from './IconButton';

import type { ReactNode } from 'react';

export interface TopBarProps {
  onBack: () => void;
  backLabel?: string;
  backTestID?: string;
  /** Buttons on the right. */
  children?: ReactNode;
}

/** A pushed screen's top row: a Back button on the left and actions on the right. */
export function TopBar({ onBack, backLabel = 'Back', backTestID, children }: TopBarProps) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.bar, { gap: spacing.xs, marginTop: -spacing.sm, marginHorizontal: -spacing.sm }]}>
      <IconButton icon="arrow-left" accessibilityLabel={backLabel} onPress={onBack} testID={backTestID} />
      <View style={styles.flex} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
