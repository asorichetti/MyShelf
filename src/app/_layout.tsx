import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { BookyOverlay, BookyTouchArea } from '@/components/booky';
import { SnackbarProvider } from '@/components/ui';
import { DatabaseProvider, type DatabaseStatus } from '@/db';
import { openAppDatabase } from '@/db/expo';
import { BookyRoot } from '@/features/booky/BookyRoot';
import { withE2eDatabaseFault } from '@/features/e2e/databaseFault';
import { e2eFontScale } from '@/features/e2e/fontScale';
import { LoanWatchers } from '@/features/loans/LoanWatchers';
import { AppSnackbarHost } from '@/features/navigation/AppSnackbarHost';
import { DatabaseErrorScreen } from '@/features/navigation/DatabaseErrorScreen';
import { LoadingScreen } from '@/features/navigation/LoadingScreen';
import { AppErrorBoundary, screenErrorLayout } from '@/features/navigation/ScreenErrorBoundary';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { SettingsWatchers } from '@/features/settings/SettingsWatchers';
import { ThemeProvider, useTheme } from '@/theme';
import { appFonts } from '@/theme/fonts';

// Keep the native splash up until fonts and the database are ready (must run at module scope).
SplashScreen.preventAutoHideAsync().catch(() => {});

// The real opener, except on the web E2E build when a journey asks for a database failure.
const openDatabase = withE2eDatabaseFault(openAppDatabase);

// Only the web E2E build can override the text size (a large-text check); a phone uses its own setting.
const fontScaleOverride = e2eFontScale();

function RootStack() {
  const theme = useTheme();
  return (
    <BookyRoot>
      <SnackbarProvider>
        {/* Dark icons on light paper, light icons on the night library. */}
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        {/* A tap anywhere outside Booky's tip puts it away. */}
        <BookyTouchArea style={{ flex: 1 }}>
          {/* Every screen has its own error boundary: one crash never blanks the app (P09-04). */}
          <Stack screenLayout={screenErrorLayout} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.paper } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
          </Stack>
          {/* Above every screen, so an Undo survives leaving the screen that offered it. */}
          <AppSnackbarHost />
          {/* Booky's tips, above every screen and clear of its bottom actions. */}
          <BookyOverlay />
        </BookyTouchArea>
        <LoanWatchers />
        <SettingsWatchers />
        <OnboardingGate />
      </SnackbarProvider>
    </BookyRoot>
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
    <ThemeProvider fontScale={fontScaleOverride}>
      <DatabaseProvider
        open={openDatabase}
        onStatusChange={setDbState}
        fallback={fontsReady ? <LoadingScreen /> : null}
        renderError={(error, retry) => (fontsReady ? <DatabaseErrorScreen error={error} onRetry={retry} /> : null)}
      >
        {fontsReady ? (
          <AppErrorBoundary>
            <RootStack />
          </AppErrorBoundary>
        ) : null}
      </DatabaseProvider>
    </ThemeProvider>
  );
}
