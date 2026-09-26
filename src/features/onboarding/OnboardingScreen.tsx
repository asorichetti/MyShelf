import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingCard } from '@/components/booky/OnboardingCard';
import { Button, Screen } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { onboardingPages } from './onboardingPages';
import { useFinishOnboarding } from './useOnboarding';

/**
 * `/onboarding` (P07-03): four cards with Booky, shown once on first launch
 * (and again from Settings → Booky). Skip at any point; the last card offers
 * "Let's fill your shelf" (Scan) or "Look around first" (the Shelf). Either
 * way, and on Skip, it is marked done.
 */
export function OnboardingScreen() {
  const { spacing } = useTheme();
  const finish = useFinishOnboarding();
  const [page, setPage] = useState(0);
  const card = onboardingPages[page];
  const last = page === onboardingPages.length - 1;

  const leave = async (to: Href) => {
    try {
      await finish();
    } catch (e) {
      console.warn('Could not remember the onboarding was done', e);
    }
    router.replace(to);
  };

  return (
    <Screen testID={Testids.onboarding.root} centered edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.top}>
        {last ? null : <Button variant="ghost" label="Skip" accessibilityLabel="Skip the introduction" onPress={() => void leave('/')} testID={Testids.onboarding.skip} />}
      </View>
      <View style={[styles.fill, { gap: spacing.xl }]}>
        <OnboardingCard
          key={page}
          expression={card.expression}
          title={card.title}
          text={card.text}
          page={page + 1}
          pages={onboardingPages.length}
          testID={Testids.onboarding.card}
          pageTestID={Testids.onboarding.page}
        />
        {last ? (
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <Button label="Let’s fill your shelf" onPress={() => void leave('/scan')} testID={Testids.onboarding.start} />
            <Button variant="secondary" label="Look around first" onPress={() => void leave('/')} testID={Testids.onboarding.explore} />
          </View>
        ) : null}
        <View style={[styles.actions, { gap: spacing.sm }]}>
          {page > 0 ? <Button variant="ghost" label="Back" onPress={() => setPage(page - 1)} testID={Testids.onboarding.back} /> : null}
          {last ? null : <Button label="Next" accessibilityLabel={`Next: page ${page + 2} of ${onboardingPages.length}`} onPress={() => setPage(page + 1)} testID={Testids.onboarding.next} />}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 48 },
  fill: { flexGrow: 1, justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
