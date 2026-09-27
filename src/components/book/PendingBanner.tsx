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

export interface ArrivedBannerProps {
  /** Books scanned offline whose details have arrived. */
  count: number;
  /** The ISBN "Review" opens (the first waiting), for its spoken name. */
  isbn: string;
  onReview: () => void;
}

/** "I found details for 2 books you scanned offline." with Review (P02-10): the user chooses the edition and saves. */
export function ArrivedBanner({ count, isbn, onReview }: ArrivedBannerProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      testID={Testids.pending.arrived}
      role="status"
      aria-live="polite"
      accessibilityLiveRegion="polite"
      style={[styles.row, { backgroundColor: colors.accentContainer, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }]}
    >
      <MaterialCommunityIcons name="cloud-check-outline" size={sizes.icon} color={colors.onAccentContainer} aria-hidden />
      <Text color="onAccentContainer" style={styles.text}>
        {t('shelf.pending.arrived', { count })}
      </Text>
      <Button variant="ghost" label={t('shelf.pending.review')} accessibilityLabel={t('shelf.pending.reviewLabel', { isbn })} onPress={onReview} testID={Testids.pending.review} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 160 },
});
