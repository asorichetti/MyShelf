import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookyTipHost } from '@/components/booky';
import { useTheme } from '@/theme';

/** Stack screens with a bar of actions along the bottom, which a tip must never cover (PLAN §8). */
const BOTTOM_BARS = new Set(['book/new', 'book/[id]/edit', 'scan/pick', 'scan/review']);

/**
 * Booky's tips over screens outside the tabs (the tab layout has its own
 * host): e.g. "Shelved! That's 12 books." on a book saved from a scan.
 * Hidden on screens whose bottom bar holds the primary action.
 */
export function StackBookyTipHost() {
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const { spacing } = useTheme();
  if (!segments.length || segments[0] === '(tabs)' || BOTTOM_BARS.has(segments.join('/'))) return null;
  return <BookyTipHost style={{ bottom: insets.bottom + spacing.md }} />;
}
