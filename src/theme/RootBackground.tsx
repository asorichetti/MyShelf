import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { useTheme } from './ThemeProvider';

/**
 * Paints the app's root view with the theme's paper (Android, iOS), so
 * nothing lighter or darker shows behind a screen transition or the keyboard.
 * The native window starts on the paper of the phone's own scheme
 * (`app.json` backgroundColor, and values-night from
 * plugins/withAndroidNightBackground); this follows the theme as it
 * resolves, including a Light or Dark choice under Appearance that differs
 * from the phone's.
 */
export function RootBackground(): null {
  const paper = useTheme().colors.paper;
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(paper).catch(() => {});
  }, [paper]);
  return null;
}
