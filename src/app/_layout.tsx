import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BookyProvider } from '@/components/booky';
import { SnackbarProvider } from '@/components/ui';
import { DatabaseProvider, type DatabaseStatus } from '@/db';
import { openAppDatabase } from '@/db/expo';
import { LoanWatchers } from '@/features/loans/LoanWatchers';
import { AppSnackbarHost } from '@/features/navigation/AppSnackbarHost';
import { DatabaseErrorScreen } from '@/features/navigation/DatabaseErrorScreen';
import { LoadingScreen } from '@/features/navigation/LoadingScreen';
import { StackBookyTipHost } from '@/features/navigation/StackBookyTipHost';
import { SeriesEventHost } from '@/features/series/SeriesEventHost';
import { ThemeProvider, useTheme } from '@/theme';
import { appFonts } from '@/theme/fonts';

// Keep the native splash up until fonts and the database are ready (must run at module scope).
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const theme = useTheme();
  return (
    <BookyProvider>
      <SnackbarProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.paper } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
          </Stack>
          {/* Above every screen, so an Undo survives leaving the screen that offered it. */}
          <AppSnackbarHost />
          <StackBookyTipHost />
          {/* Booky's series gap tip and completion celebration, wherever a save lands. */}
          <SeriesEventHost />
        </View>
        <LoanWatchers />
      </SnackbarProvider>
    </BookyProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const [dbState, setDbState] = useState<DatabaseStatus['state']>('loading');
  const fontsReady = fontsLoaded || fontError != null;
  const ready = fontsReady && dbState !== 'loading';

  useEffect(() => {
    if (fontError) console.warn('Fonts failed to load; falling back to system fonts.', fontError);
  }, [fontError]);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  return (
    <ThemeProvider>
      <DatabaseProvider
        open={openAppDatabase}
        onStatusChange={setDbState}
        fallback={fontsReady ? <LoadingScreen /> : null}
        renderError={(error, retry) => (fontsReady ? <DatabaseErrorScreen error={error} onRetry={retry} /> : null)}
      >
        {fontsReady ? <RootStack /> : null}
      </DatabaseProvider>
    </ThemeProvider>
  );
}
