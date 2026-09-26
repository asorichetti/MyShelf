import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CoverImage } from '@/components/book/CoverImage';
import { Text } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { groupSwatch, useTheme } from '@/theme';

import { groupIconName } from './groupIconNames';

export interface GroupCardData {
  id: number;
  name: string;
  colour: string | null;
  icon: string | null;
  count: number;
  covers: { id: number; title: string; coverUri: string | null }[];
}

export const groupCardLabel = (g: Pick<GroupCardData, 'name' | 'count'>) => `${g.name}, ${g.count === 1 ? '1 book' : `${g.count} books`}`;

export interface GroupCardProps {
  group: GroupCardData;
  onPress: (id: number) => void;
}

/**
 * A group on the Groups tab: a band in the group's colour with its icon and
 * name, then a fanned collage of its first three covers and the book count.
 */
export const GroupCard = memo(function GroupCard({ group, onPress }: GroupCardProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const swatch = groupSwatch(group.colour, theme.scheme);
  const thumb = theme.coverSizes.thumb;
  return (
    <Pressable
      role="button"
      accessibilityLabel={groupCardLabel(group)}
      aria-label={groupCardLabel(group)}
      onPress={() => onPress(group.id)}
      testID={Testids.groups.card}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceTint : colors.surface,
          borderColor: colors.border,
          borderRadius: radii.md,
          boxShadow: theme.elevation.card,
        },
      ]}
    >
      <View style={[styles.band, { backgroundColor: swatch.band, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, minHeight: sizes.touchTarget }]}>
        <MaterialCommunityIcons name={groupIconName(group.icon)} size={sizes.icon} color={swatch.onBand} />
        <Text variant="bodyStrong" numberOfLines={2} style={[styles.name, { color: swatch.onBand, fontFamily: theme.fonts.heading }]}>
          {group.name}
        </Text>
      </View>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={[styles.collage, { height: thumb.height + spacing.sm }]} aria-hidden>
          {group.covers.length ? (
            group.covers.map((c, i) => (
              <View key={c.id} style={[styles.fan, { left: i * (thumb.width * 0.6), top: i % 2 ? spacing.sm : 0, zIndex: 3 - i, transform: [{ rotate: `${(i - 1) * 4}deg` }] }]}>
                <CoverImage uri={c.coverUri} title={c.title} size="thumb" />
              </View>
            ))
          ) : (
            <View style={[styles.empty, { width: thumb.width, height: thumb.height, borderColor: colors.outline, borderRadius: radii.sm }]}>
              <MaterialCommunityIcons name="book-plus-outline" size={sizes.icon} color={colors.inkMuted} />
            </View>
          )}
        </View>
        <Text variant="stamp" color="accent">
          {group.count === 1 ? '1 book' : `${group.count} books`}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, overflow: 'hidden' },
  band: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1 },
  collage: { position: 'relative' },
  fan: { position: 'absolute' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
