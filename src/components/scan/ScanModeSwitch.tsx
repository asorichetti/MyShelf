import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export type ScanMode = 'barcode' | 'cover';

const OPTIONS: { mode: ScanMode; label: string; icon: 'barcode-scan' | 'book-open-variant'; testID: string }[] = [
  { mode: 'barcode', label: 'Barcode', icon: 'barcode-scan', testID: Testids.scan.modeBarcode },
  { mode: 'cover', label: 'Cover', icon: 'book-open-variant', testID: Testids.scan.modeCover },
];

/** Barcode or cover (P03-13): a two-way segmented control, announced as tabs of one list. */
export function ScanModeSwitch({ mode, onChange }: { mode: ScanMode; onChange: (mode: ScanMode) => void }) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <View role="radiogroup" aria-label="What to scan" style={[styles.row, { borderColor: colors.primary, borderRadius: radii.pill, padding: spacing.xxs, backgroundColor: colors.surface }]}>
      {OPTIONS.map((o) => {
        const selected = o.mode === mode;
        return (
          <Pressable
            key={o.mode}
            role="radio"
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.mode === 'barcode' ? 'Scan the barcode' : 'Read the cover'}
            aria-label={o.mode === 'barcode' ? 'Scan the barcode' : 'Read the cover'}
            onPress={() => onChange(o.mode)}
            testID={o.testID}
            style={({ pressed }) => [
              styles.option,
              {
                minHeight: sizes.touchTarget,
                gap: spacing.xs,
                borderRadius: radii.pill,
                backgroundColor: selected ? colors.primary : pressed ? colors.surfaceTint : 'transparent',
              },
            ]}
          >
            <MaterialCommunityIcons name={o.icon} size={sizes.icon} color={selected ? colors.onPrimary : colors.primary} aria-hidden />
            <Text variant="bodyStrong" color={selected ? 'onPrimary' : 'primary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1.5 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
