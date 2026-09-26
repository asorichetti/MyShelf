import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, IconButton, Text } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface SelectionBarProps {
  count: number;
  onCancel: () => void;
  onAddToGroup?: () => void;
  /** Label for the add button, e.g. "Add to Favourites" when the group is already known. */
  addLabel?: string;
  /** Only in a group's own view: take the selected books out of it. */
  onRemoveFromGroup?: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const selectionCountLabel = (n: number) => (n === 0 ? 'Select books' : n === 1 ? '1 book selected' : `${n} books selected`);

/**
 * The action bar shown while books are selected: how many (announced
 * politely), "Add to group…", "Remove from group" in a group's view, "Delete",
 * and a button to stop selecting (Android back does the same).
 */
export function SelectionBar({ count, onCancel, onAddToGroup, addLabel = 'Add to group…', onRemoveFromGroup, onDelete, style }: SelectionBarProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const none = count === 0;
  return (
    <View
      testID={Testids.selection.bar}
      role="toolbar"
      aria-label="Selected books"
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.sm, gap: spacing.xs, boxShadow: theme.elevation.raised },
        style,
      ]}
    >
      <View style={[styles.row, { gap: spacing.xs }]}>
        <IconButton icon="close" accessibilityLabel="Stop selecting" onPress={onCancel} testID={Testids.selection.cancel} />
        <Text variant="bodyStrong" role="status" aria-live="polite" accessibilityLiveRegion="polite" testID={Testids.selection.count} style={styles.flex}>
          {selectionCountLabel(count)}
        </Text>
      </View>
      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        {onAddToGroup ? (
          <Button
            variant="primary"
            label={addLabel}
            disabled={none}
            onPress={onAddToGroup}
            testID={Testids.selection.addToGroup}
            icon={<MaterialCommunityIcons name="tag-plus-outline" size={sizes.icon} color={colors.onPrimary} />}
          />
        ) : null}
        {onRemoveFromGroup ? (
          <Button variant="secondary" label="Remove from group" disabled={none} onPress={onRemoveFromGroup} testID={Testids.selection.remove} />
        ) : null}
        {onDelete ? <Button variant="danger" label="Delete" disabled={none} onPress={onDelete} testID={Testids.selection.delete} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  flex: { flex: 1 },
});
