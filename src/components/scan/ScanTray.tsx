import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface ScanTrayProps {
  count: number;
  /** How many still need an edition chosen. */
  needsChoice: number;
  onReview: () => void;
}

/** The "Scan several" tray (P03-12): a counter badge and "Review N books". */
export function ScanTray({ count, needsChoice, onReview }: ScanTrayProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const inTray = t('scan.tray.inTray', { count });
  return (
    <View style={[styles.row, { gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.primaryContainer }]}>
      <View style={[styles.badge, { minWidth: sizes.iconButton, height: sizes.iconButton, borderRadius: radii.pill, backgroundColor: colors.primary, paddingHorizontal: spacing.sm }]}>
        <Text variant="bodyStrong" color="onPrimary" testID={Testids.scan.trayCount} aria-label={inTray}>
          {String(count)}
        </Text>
      </View>
      <View style={styles.fill}>
        <Text color="onPrimaryContainer" aria-live="polite" accessibilityLiveRegion="polite">
          {count ? inTray : t('scan.tray.empty')}
        </Text>
        {needsChoice ? (
          <Text variant="caption" color="onPrimaryContainer">
            {t('scan.tray.needsChoice', { count: needsChoice })}
          </Text>
        ) : null}
      </View>
      <Button
        label={t('scan.tray.review', { count })}
        onPress={onReview}
        disabled={!count}
        testID={Testids.scan.reviewOpen}
        icon={<MaterialCommunityIcons name="tray-full" size={sizes.icon} color={colors.onPrimary} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  badge: { alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1, minWidth: 140 },
});
