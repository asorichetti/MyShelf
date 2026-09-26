import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui';
import { useTheme } from '@/theme';

/** A book's genres as a list of chips. */
export function GenreChips({ genres, testID }: { genres: readonly string[]; testID?: string }) {
  const { spacing } = useTheme();
  return (
    <View role="list" testID={testID} style={[styles.row, { columnGap: spacing.sm }]}>
      {genres.map((g) => (
        <View role="listitem" key={g}>
          <Chip label={g} icon="tag-outline" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
