import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { SeriesSummary } from '@/db';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { MiniSpines } from './MiniSpines';
import { progressSentence, progressText, seriesLabel } from './seriesText';

export interface SeriesRowProps {
  series: SeriesSummary;
  onPress: (id: number) => void;
}

/**
 * One series in the list: its name, a mini shelf of spines (dashed where a
 * book is missing) and "5 of 9". Read as "Discworld, 5 of 9 owned, 2 missing".
 */
export const SeriesRow = memo(function SeriesRow({ series, onPress }: SeriesRowProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const complete = series.totalCount != null && series.missing === 0 && series.total != null;
  return (
    <Pressable
      role="link"
      accessibilityLabel={seriesLabel(series)}
      onPress={() => onPress(series.id)}
      testID={Testids.seriesList.row}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: sizes.touchTarget,
          padding: spacing.md,
          gap: spacing.md,
          borderRadius: radii.md,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceTint : colors.surface,
          boxShadow: theme.elevation.card,
        },
      ]}
    >
      <View style={[styles.body, { gap: spacing.xs }]}>
        <View style={[styles.line, { gap: spacing.sm }]}>
          <Text variant="bodyStrong" style={[theme.typography.h3, styles.flex]} numberOfLines={2}>
            {series.name}
          </Text>
          <Text variant="mono" color={complete ? 'success' : 'accent'}>
            {progressText(series)}
          </Text>
        </View>
        <MiniSpines name={series.name} total={series.total} gaps={series.gaps} />
        <Text variant="caption" color="inkMuted">
          {complete ? 'Complete!' : progressSentence(series)}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={sizes.icon + 4} color={colors.inkMuted} aria-hidden />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  body: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'baseline' },
  flex: { flex: 1, minWidth: 0 },
});
