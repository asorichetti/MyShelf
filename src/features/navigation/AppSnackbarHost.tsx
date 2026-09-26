import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SnackbarHost } from '@/components/ui';
import { useTheme } from '@/theme';

/** The app's one snackbar, kept clear of the tab bar on tab screens. */
export function AppSnackbarHost() {
  const { spacing, sizes } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const onTabs = segments[0] === '(tabs)' || segments.length === 0;
  return <SnackbarHost style={{ bottom: insets.bottom + spacing.md + (onTabs ? sizes.tabBar : 0) }} />;
}
