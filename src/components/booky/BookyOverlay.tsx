import { router, usePathname, useSegments, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayers } from '@/components/ui/layers';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { BookyBubble, type BookyAction } from './BookyBubble';
import { useBooky, type ShownTip } from './BookyProvider';
import { Celebration } from './Celebration';
import { HelpSheet } from './HelpSheet';
import { placement } from './placement';

import type { TipTestGroup } from './tips';

/** Screens Booky's tips never float over: the fixture loader and the onboarding (it has its own Booky). */
const QUIET_ROUTES = new Set(['e2e', 'onboarding']);

/** Stack screens with a bar of actions along the bottom: a tip waits until the user leaves (PLAN §8). */
const BOTTOM_BARS = new Set(['book/new', 'book/[id]/edit', 'scan/pick', 'scan/review']);

/** The narrowest a bubble may get when it steps aside for a button. */
const MIN_BUBBLE_WIDTH = 260;

interface TipTestIds {
  root: string;
  bubble?: string;
  text: string;
  dismiss: string;
  action: string;
  confetti?: string;
}

const testIds: Record<TipTestGroup | 'booky', TipTestIds> = {
  booky: { root: Testids.booky.tipHost, bubble: Testids.booky.bubble, text: Testids.booky.bubbleText, dismiss: Testids.booky.dismiss, action: Testids.booky.action },
  seriesTip: { root: Testids.seriesTip.root, text: Testids.seriesTip.text, dismiss: Testids.seriesTip.dismiss, action: Testids.seriesTip.open },
  seriesCelebration: {
    root: Testids.seriesCelebration.root,
    text: Testids.seriesCelebration.text,
    dismiss: Testids.seriesCelebration.dismiss,
    action: Testids.booky.action,
    confetti: Testids.seriesCelebration.confetti,
  },
};

/**
 * Whether a tip waits on this route: every tip on the fixture loader and the
 * onboarding; all but help (asked for, and placed above the bar) on screens
 * whose bottom bar holds the primary action.
 */
export function tipWaits(segments: readonly string[], tip: Pick<ShownTip, 'tip'>): boolean {
  if (QUIET_ROUTES.has(segments[0] ?? '')) return true;
  return BOTTOM_BARS.has(segments.join('/')) && tip.tip.kind !== 'help';
}

/**
 * Booky's tips, floating over every screen (placed once, in the root
 * layout). Docks above the tab bar (or the bottom edge on other screens) and
 * steps aside or lifts above the Add book button, the selection bar, the
 * snackbar and the keyboard (`placement`). Hidden while a dialog or sheet is
 * open, on the onboarding and on screens whose bottom bar holds the primary
 * action; the tip waits and shows when it can. A screen-bound tip is put away
 * when the user moves to another screen.
 */
export function BookyOverlay() {
  const { tip, dismissTip, help, closeHelp } = useBooky();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const bound = useRef<{ showId: number; path: string } | null>(null);

  useEffect(() => {
    if (!tip?.tip.screenBound) {
      bound.current = null;
      return;
    }
    if (bound.current?.showId !== tip.showId) bound.current = { showId: tip.showId, path: pathname };
    else if (bound.current.path !== pathname) dismissTip();
  }, [tip, pathname, dismissTip]);

  return (
    <>
      {tip && !tipWaits(segments, tip) ? <PlacedTip tip={tip} onTabs={segments[0] === '(tabs)' || segments.length === 0} /> : null}
      <HelpSheet screen={help?.screen ?? null} onClose={closeHelp} />
    </>
  );
}

function PlacedTip({ tip, onTabs }: { tip: ShownTip; onTabs: boolean }) {
  const { dismissTip, runAction } = useBooky();
  const { spacing, sizes } = useTheme();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const layers = useLayers();
  const keyboardHeight = useKeyboardHeight();
  const [bubbleHeight, setBubbleHeight] = useState(0);

  if (layers.blocking > 0) return null;
  const place = placement({
    window: win,
    dock: insets.bottom + spacing.md + (onTabs ? sizes.tabBar : 0),
    margin: spacing.md,
    maxWidth: sizes.bubbleMaxWidth,
    minWidth: MIN_BUBBLE_WIDTH,
    bubbleHeight,
    topInset: insets.top,
    obstacles: layers.obstacles,
    keyboardHeight,
  });
  if (!place.visible) return null;

  const ids = testIds[tip.tip.testGroup ?? 'booky'];
  const action = tip.action;
  const actions: BookyAction[] = action
    ? [
        {
          label: action.label,
          testID: action.id === 'help-more' ? Testids.booky.helpMore : ids.action,
          onPress: () => {
            if (action.href) {
              dismissTip();
              router.navigate(action.href as Href);
            } else runAction(tip);
          },
        },
      ]
    : [];
  const onLayout = (e: LayoutChangeEvent) => setBubbleHeight(Math.round(e.nativeEvent.layout.height));

  if (tip.tip.celebration) {
    return (
      <Celebration
        key={tip.showId}
        title={tip.title}
        message={tip.text}
        onDismiss={dismissTip}
        actions={actions}
        bottom={place.bottom}
        testID={ids.root}
        messageTestID={ids.text}
        dismissTestID={ids.dismiss}
        confettiTestID={ids.confetti}
      />
    );
  }
  return (
    <View style={[styles.host, { left: place.left, width: place.width, bottom: place.bottom }]} testID={ids.root} onLayout={onLayout}>
      <BookyBubble
        key={tip.showId}
        message={tip.text}
        title={tip.title}
        expression={tip.tip.expression}
        actions={actions}
        onDismiss={dismissTip}
        testID={ids.bubble}
        messageTestID={ids.text}
        dismissTestID={ids.dismiss}
        avatarTestID={Testids.booky.avatar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { pointerEvents: 'box-none', position: 'absolute' },
});
