import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Heading, IconButton } from '@/components/ui';
import { sectionHeading, sectionLabel } from '@/domain';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface SectionHeaderProps {
  title: string;
  count: number;
  /** Opens the section's own page (a genre, series, author or group), shown as a chevron button. */
  onOpen?: () => void;
  testID?: string;
}

/**
 * A Shelf section title ("Fantasy · 23") standing on a brass shelf edge, like
 * the label rail of a library bookcase. A level-2 heading named "Fantasy,
 * 23 books" for screen readers.
 */
export const SectionHeader = memo(function SectionHeader({ title, count, onOpen, testID = Testids.shelfView.sectionHeader }: SectionHeaderProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  return (
    <View testID={testID} style={[styles.root, { paddingTop: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.paper }]}>
      <View style={[styles.row, { gap: spacing.sm, minHeight: sizes.touchTarget }]}>
        <Heading level={2} style={[theme.typography.h3, styles.title]} numberOfLines={2} accessibilityLabel={sectionLabel(title, count)}>
          {sectionHeading(title, count)}
        </Heading>
        {onOpen ? <IconButton icon="chevron-right" accessibilityLabel={t('shelfView.section.open', { title })} onPress={onOpen} /> : null}
      </View>
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.edge, { backgroundColor: colors.brass, borderRadius: radii.sm, boxShadow: theme.elevation.low }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {},
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  edge: { height: 6, alignSelf: 'stretch' },
});
