import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, Text, type IconName } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export type BrowseTarget = 'genres' | 'series' | 'authors' | 'groups';

export const browseChips: { target: BrowseTarget; label: string; icon: IconName; testID: string }[] = [
  { target: 'genres', label: 'Genres', icon: 'tag-outline', testID: Testids.shelfView.browseGenres },
  { target: 'series', label: 'Series', icon: 'bookshelf', testID: Testids.shelfView.browseSeries },
  { target: 'authors', label: 'Authors', icon: 'account-edit-outline', testID: Testids.shelfView.browseAuthors },
  { target: 'groups', label: 'Groups', icon: 'tag-multiple-outline', testID: Testids.shelfView.browseGroups },
];

export interface BrowseChipsProps {
  onBrowse: (target: BrowseTarget) => void;
}

/** "Browse" row at the top of the Shelf: one chip each for the genre, series, author and group indexes. */
export function BrowseChips({ onBrowse }: BrowseChipsProps) {
  const { spacing } = useTheme();
  return (
    <View testID={Testids.shelfView.browse} role="navigation" aria-label="Browse" style={{ gap: spacing.xxs }}>
      <Text variant="label" color="inkMuted">
        Browse
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { gap: spacing.sm }]}>
        {browseChips.map((c) => (
          <Chip
            key={c.target}
            label={c.label}
            icon={c.icon}
            accessibilityLabel={`Browse ${c.label.toLowerCase()}`}
            onPress={() => onBrowse(c.target)}
            testID={c.testID}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
