import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface PendingBannerProps {
  /** Books scanned offline whose details are still to come. */
  count: number;
  retrying: boolean;
  onRetry: () => void;
}

/** "2 books waiting for details" (P02-10): shown on the Shelf while the offline queue has work. */
export function PendingBanner({ count, retrying, onRetry }: PendingBannerProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  if (count <= 0) return null;
  const message = t('shelf.pending.message', { count });
  return (
    <View
      testID={Testids.pending.banner}
      role="status"
      aria-live="polite"
      accessibilityLiveRegion="polite"
      style={[styles.row, { backgroundColor: colors.warnContainer, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }]}
    >
      <MaterialCommunityIcons name="cloud-clock-outline" size={sizes.icon} color={colors.onWarnContainer} aria-hidden />
      <Text color="onWarnContainer" style={styles.text}>
        {message}
      </Text>
      <Button variant="ghost" label={retrying ? t('shelf.pending.trying') : t('shelf.pending.tryNow')} onPress={onRetry} disabled={retrying} testID={Testids.pending.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 160 },
});
