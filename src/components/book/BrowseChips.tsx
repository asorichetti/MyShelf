import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, Text, type IconName } from '@/components/ui';
import { t, translate, type MessageKey } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export type BrowseTarget = 'genres' | 'series' | 'authors' | 'groups';

export const browseChips: { target: BrowseTarget; label: MessageKey; accessibilityLabel: MessageKey; icon: IconName; testID: string }[] = [
  { target: 'genres', label: 'shelfView.browse.genres', accessibilityLabel: 'shelfView.browse.genresLabel', icon: 'tag-outline', testID: Testids.shelfView.browseGenres },
  { target: 'series', label: 'shelfView.browse.series', accessibilityLabel: 'shelfView.browse.seriesLabel', icon: 'bookshelf', testID: Testids.shelfView.browseSeries },
  { target: 'authors', label: 'shelfView.browse.authors', accessibilityLabel: 'shelfView.browse.authorsLabel', icon: 'account-edit-outline', testID: Testids.shelfView.browseAuthors },
  { target: 'groups', label: 'shelfView.browse.groups', accessibilityLabel: 'shelfView.browse.groupsLabel', icon: 'tag-multiple-outline', testID: Testids.shelfView.browseGroups },
];

export interface BrowseChipsProps {
  onBrowse: (target: BrowseTarget) => void;
}

/** "Browse" row at the top of the Shelf: one chip each for the genre, series, author and group indexes. */
export function BrowseChips({ onBrowse }: BrowseChipsProps) {
  const { spacing } = useTheme();
  return (
    <View testID={Testids.shelfView.browse} role="navigation" aria-label={t('shelfView.browse.heading')} style={{ gap: spacing.xxs }}>
      <Text variant="label" color="inkMuted">
        {t('shelfView.browse.heading')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { gap: spacing.sm }]}>
        {browseChips.map((c) => (
          <Chip
            key={c.target}
            label={translate(c.label)}
            icon={c.icon}
            accessibilityLabel={translate(c.accessibilityLabel)}
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
