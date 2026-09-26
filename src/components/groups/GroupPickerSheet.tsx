import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { groupSwatch, useTheme } from '@/theme';

import { groupIconName } from './groupIconNames';

export interface PickableGroup {
  id: number;
  name: string;
  colour: string | null;
  icon: string | null;
  count: number;
}

export interface GroupPickerSheetProps {
  visible: boolean;
  /** e.g. "Add 3 books to a group". */
  title: string;
  groups: PickableGroup[];
  /** Groups that already hold every book being added: shown as "Already here" and not offered. */
  disabledIds?: ReadonlySet<number>;
  onPick: (groupId: number) => void;
  /** Make a new group for these books. */
  onNew: () => void;
  onClose: () => void;
}

/** Picks the group to add books to, or starts a new one. Each group is a 48 dp button named "Favourites, 3 books". */
export function GroupPickerSheet({ visible, title, groups, disabledIds, onPick, onNew, onClose }: GroupPickerSheetProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={groups.length ? undefined : 'You have no groups yet. Make one and I’ll put the books in it.'}
      onClose={onClose}
      testID={Testids.groups.pickerSheet}
      footer={
        <>
          <Button variant="ghost" label="Cancel" onPress={onClose} testID={Testids.groups.pickerClose} />
          <Button
            variant="secondary"
            label="New group…"
            onPress={onNew}
            testID={Testids.groups.pickerNew}
            icon={<MaterialCommunityIcons name="plus" size={sizes.icon} color={colors.onPrimaryContainer} />}
          />
        </>
      }
    >
      <View role="list" aria-label="Your groups" style={{ gap: spacing.xs }}>
        {groups.map((g) => {
          const swatch = groupSwatch(g.colour, theme.scheme);
          const already = disabledIds?.has(g.id) ?? false;
          const count = g.count === 1 ? '1 book' : `${g.count} books`;
          return (
            <View role="listitem" key={g.id}>
              <Pressable
                role="button"
                accessibilityLabel={already ? `${g.name}, already added` : `${g.name}, ${count}`}
                aria-disabled={already}
                disabled={already}
                onPress={() => onPick(g.id)}
                testID={Testids.groups.pickerOption}
                style={({ pressed }) => [
                  styles.option,
                  {
                    minHeight: sizes.touchTarget,
                    paddingHorizontal: spacing.sm,
                    gap: spacing.md,
                    borderRadius: radii.md,
                    backgroundColor: pressed ? colors.surfaceTint : 'transparent',
                    opacity: already ? 0.6 : 1,
                  },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: swatch.band, borderRadius: radii.pill, width: sizes.iconButton, height: sizes.iconButton }]}>
                  <MaterialCommunityIcons name={groupIconName(g.icon)} size={sizes.icon - 2} color={swatch.onBand} />
                </View>
                <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text variant="caption" color="inkMuted">
                  {already ? 'Already here' : count}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center' },
  icon: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
