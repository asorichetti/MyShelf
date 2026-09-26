import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
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
  const books = count === 1 ? '1 book' : `${count} books`;
  return (
    <View style={[styles.row, { gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.primaryContainer }]}>
      <View style={[styles.badge, { minWidth: sizes.iconButton, height: sizes.iconButton, borderRadius: radii.pill, backgroundColor: colors.primary, paddingHorizontal: spacing.sm }]}>
        <Text variant="bodyStrong" color="onPrimary" testID={Testids.scan.trayCount} aria-label={`${books} in the tray`}>
          {String(count)}
        </Text>
      </View>
      <View style={styles.fill}>
        <Text color="onPrimaryContainer" aria-live="polite" accessibilityLiveRegion="polite">
          {count ? `${books} in the tray` : 'Scanned books wait here until you review them.'}
        </Text>
        {needsChoice ? (
          <Text variant="caption" color="onPrimaryContainer">
            {needsChoice === 1 ? '1 needs a choice of edition' : `${needsChoice} need a choice of edition`}
          </Text>
        ) : null}
      </View>
      <Button
        label={`Review ${books}`}
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
