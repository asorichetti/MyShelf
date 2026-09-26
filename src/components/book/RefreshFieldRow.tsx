import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { refreshFieldLabels, type FieldChange } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/** "Summary: add" / "Pages: 223 → 214", as a screen reader hears the row. */
export function changeLabel(change: FieldChange): string {
  const name = refreshFieldLabels[change.field];
  return change.kind === 'add' ? `${name}: add ${change.to}` : `${name}: ${change.from} → ${change.to}`;
}

export interface RefreshFieldRowProps {
  change: FieldChange;
  checked: boolean;
  onToggle: () => void;
}

/**
 * One proposed change in "Refresh details": a checkbox with the field, what
 * it is now and what it would become. Long values (a summary) are clipped
 * to a few lines.
 */
export function RefreshFieldRow({ change, checked, onToggle }: RefreshFieldRowProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  const name = refreshFieldLabels[change.field];
  return (
    <View testID={Testids.refresh.fieldRow}>
      <Pressable
        role="checkbox"
        aria-checked={checked}
        accessibilityState={{ checked }}
        accessibilityLabel={changeLabel(change)}
        aria-label={changeLabel(change)}
        onPress={onToggle}
        testID={Testids.refresh.fieldToggle}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: sizes.touchTarget,
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            borderColor: checked ? colors.primary : colors.border,
            backgroundColor: pressed ? colors.surfaceTint : colors.surface,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={sizes.icon + 4}
          color={checked ? colors.primary : colors.outline}
          aria-hidden
        />
        <View style={[styles.text, { gap: spacing.xxs }]}>
          <Text variant="bodyStrong">{`${name}: ${change.kind === 'add' ? 'add' : 'update'}`}</Text>
          {change.kind === 'change' ? (
            <Text variant="caption" color="inkMuted" numberOfLines={2}>
              {`Now: ${change.from}`}
            </Text>
          ) : null}
          <Text numberOfLines={change.field === 'summary' ? 4 : 2}>{change.kind === 'change' ? `New: ${change.to}` : change.to}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5 },
  text: { flex: 1 },
});
