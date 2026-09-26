import { router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookyBubble, Celebration } from '@/components/booky';
import type { SeriesMilestone } from '@/domain';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { subscribeSeriesMilestones } from './seriesEvents';

/**
 * Shows series milestones wherever the user is (P04-07, P04-08): Booky's gap
 * tip ("You have #1 and #3 of Discworld — #2 is missing.") and the
 * completion celebration. It sits in the root layout, above every screen,
 * because a save lands on the book's page, outside the tabs where Booky's
 * usual tip host lives. It floats above the tab bar and the snackbar.
 */
export function SeriesEventHost() {
  const { spacing, sizes } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const onTabs = segments[0] === '(tabs)' || segments.length === 0;
  const [milestone, setMilestone] = useState<SeriesMilestone | null>(null);

  // A newer milestone replaces the one showing (a completion outranks a tip).
  useEffect(() => subscribeSeriesMilestones((m) => setMilestone((current) => (current?.type === 'series-complete' && m.type === 'series-gap' ? current : m))), []);

  if (!milestone) return null;
  // Clear of the tab bar and of a snackbar that may be showing at the same time.
  const bottom = insets.bottom + spacing.md + (onTabs ? sizes.tabBar : 0) + sizes.touchTarget + spacing.lg;
  const dismiss = () => setMilestone(null);
  const openSeries = {
    label: 'See the series',
    onPress: () => {
      dismiss();
      router.navigate({ pathname: '/series/[id]', params: { id: String(milestone.seriesId) } });
    },
  };

  if (milestone.type === 'series-complete') {
    return (
      <Celebration
        key={`${milestone.seriesId}`}
        title="Hooray!"
        message={milestone.message}
        onDismiss={dismiss}
        actions={[openSeries]}
        bottom={bottom}
        testID={Testids.seriesCelebration.root}
        messageTestID={Testids.seriesCelebration.text}
        dismissTestID={Testids.seriesCelebration.dismiss}
        confettiTestID={Testids.seriesCelebration.confetti}
      />
    );
  }
  return (
    <View style={[styles.host, { left: spacing.md, right: spacing.md, bottom, maxWidth: sizes.bubbleMaxWidth }]} testID={Testids.seriesTip.root}>
      <BookyBubble
        expression="thinking"
        message={milestone.message}
        actions={[{ ...openSeries, testID: Testids.seriesTip.open }]}
        onDismiss={dismiss}
        messageTestID={Testids.seriesTip.text}
        dismissTestID={Testids.seriesTip.dismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { pointerEvents: 'box-none', position: 'absolute', alignSelf: 'center' },
});
