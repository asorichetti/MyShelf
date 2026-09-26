import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BookyProvider } from '@/components/booky';
import { ThemeProvider, useTheme } from '@/theme';
import { appFonts } from '@/theme/fonts';

// Keep the native splash up until fonts are ready (must run at module scope).
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const theme = useTheme();
  return (
    <BookyProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </BookyProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (fontError) console.warn('Fonts failed to load; falling back to system fonts.', fontError);
  }, [fontError]);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  return <ThemeProvider>{ready ? <RootStack /> : null}</ThemeProvider>;
}
