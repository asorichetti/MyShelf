import { IconButton } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

import { useOptionalBooky } from './BookyProvider';

import type { HelpScreen } from './tips';

export interface HelpButtonProps {
  screen: HelpScreen;
  /** The screen's own "More help" (the Scan tab's barcode diagram); default: the help sheet. */
  onMore?: () => void;
}

/**
 * The `?` in a screen's header (P07-05): Booky (*thinking*) explains the
 * screen, with "More help" for the help sheet. Works in every Booky mode; in
 * Off it opens the help sheet directly. Pressing it again puts the tip away.
 */
export function HelpButton({ screen, onMore }: HelpButtonProps) {
  const booky = useOptionalBooky();
  const open = booky?.tip?.tip.id === `help-${screen}`;
  const onPress = () => {
    if (!booky) return onMore?.();
    if (open) return booky.dismissTip();
    void booky.emit({ type: 'help-requested', screen, handlers: onMore ? { 'help-more': onMore } : undefined });
  };
  return <IconButton icon="help-circle-outline" accessibilityLabel="Help with this screen" expanded={open} onPress={onPress} testID={Testids.booky.helpButton} />;
}
