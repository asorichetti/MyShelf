import { router, usePathname, useSegments, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayers } from '@/components/ui/layers';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useScreenReader } from '@/hooks/useScreenReader';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { BookyBubble, type BookyAction } from './BookyBubble';
import { useBooky, type ShownTip } from './BookyProvider';
import { Celebration } from './Celebration';
import { HelpSheet } from './HelpSheet';
import { placement } from './placement';
import { setTipBox } from './tipBox';

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

  const showing = tip && !tipWaits(segments, tip) ? tip : null;
  return (
    <>
      <Announcer tip={showing} />
      {showing ? <PlacedTip tip={showing} onTabs={segments[0] === '(tabs)' || segments.length === 0} /> : null}
      <HelpSheet screen={help?.screen ?? null} onClose={closeHelp} />
    </>
  );
}

function PlacedTip({ tip, onTabs }: { tip: ShownTip; onTabs: boolean }) {
  const { dismissTip, runAction, muteTip } = useBooky();
  const { spacing, sizes } = useTheme();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const layers = useLayers();
  const keyboardHeight = useKeyboardHeight();
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const host = useRef<View | null>(null);

  const blocked = layers.blocking > 0;
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
  const shown = !blocked && place.visible;
  // Escape puts the tip away (web), unless a dialog has Escape for itself.
  useEscapeKey(shown ? dismissTip : null);
  useEffect(() => {
    if (!shown) setTipBox(null);
    return () => setTipBox(null);
  }, [shown]);
  if (!shown) return null;

  const ids = testIds[tip.tip.testGroup ?? 'booky'];
  const actions: BookyAction[] = [];
  const press = (a: NonNullable<ShownTip['action']>) => () => {
    if (a.href) {
      dismissTip();
      router.navigate(a.href as Href);
    } else runAction(tip, a.id);
  };
  if (tip.action) actions.push({ label: tip.action.label, testID: tip.action.id === 'help-more' ? Testids.booky.helpMore : ids.action, onPress: press(tip.action) });
  if (tip.secondary) actions.push({ label: tip.secondary.label, variant: 'ghost', onPress: press(tip.secondary) });
  // Help is asked for, and a celebration is a moment: neither is a tip to mute.
  if (tip.tip.kind !== 'help' && !tip.tip.celebration) {
    actions.push({ label: t('booky.overlay.mute'), variant: 'ghost', onPress: () => muteTip(tip.tip.id), testID: Testids.booky.mute });
  }
  const onLayout = (e: LayoutChangeEvent) => {
    setBubbleHeight(Math.round(e.nativeEvent.layout.height));
    host.current?.measureInWindow?.((x, y, width, height) => setTipBox({ x, y, width, height }));
  };

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
        live={false}
      />
    );
  }
  return (
    <View ref={host} style={[styles.host, { left: place.left, width: place.width, bottom: place.bottom }]} testID={ids.root} onLayout={onLayout}>
      {/* A tip without an action goes away by itself after a while (not with a screen reader on). */}
      {actions.some((a) => a.testID !== Testids.booky.mute) ? null : <AutoDismiss key={tip.showId} onDismiss={dismissTip} />}
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
        pop
        live={false}
      />
    </View>
  );
}

/**
 * Screen readers hear each tip once, politely (P07-09): one live region that
 * is always there (a region that appears together with its text is often not
 * read), holding the current tip's words. It changes only for a new showing,
 * so a tip that waits behind a sheet and comes back is not read twice, and it
 * never takes focus. Visually hidden; the bubble shows the same words.
 */
function Announcer({ tip }: { tip: ShownTip | null }) {
  const [said, setSaid] = useState<{ showId: number; text: string } | null>(null);
  if (tip && said?.showId !== tip.showId) setSaid({ showId: tip.showId, text: tip.title ? t('booky.overlay.announceWithTitle', { title: tip.title, text: tip.text }) : tip.text });
  if (!tip && said) setSaid(null);
  return (
    <View style={styles.visuallyHidden} aria-live="polite" accessibilityLiveRegion="polite" testID={Testids.booky.announcer}>
      <Text>{said?.text ?? ''}</Text>
    </View>
  );
}

/** Tips without an action close themselves after this long (PLAN §8). */
export const AUTO_DISMISS_MS = 8000;

/** Closes the tip after `AUTO_DISMISS_MS`; paused while a screen reader is on, so nobody loses a tip mid-sentence. */
function AutoDismiss({ onDismiss }: { onDismiss: () => void }) {
  const screenReader = useScreenReader();
  useEffect(() => {
    if (screenReader) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [screenReader, onDismiss]);
  return null;
}

const styles = StyleSheet.create({
  host: { pointerEvents: 'box-none', position: 'absolute' },
  visuallyHidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none', left: 0, bottom: 0 },
});
