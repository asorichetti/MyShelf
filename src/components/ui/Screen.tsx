import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useFloatClearance } from './floatClearance';

import type { ReactNode } from 'react';

export interface ScreenProps {
  children: ReactNode;
  /** testID for the `main` landmark (e.g. the screen's root id). */
  testID?: string;
  /** Page-state marker placed on the outer container (exactly one per screen). */
  pageState?: 'loading' | 'content' | 'error';
  /**
   * Wrap content in a ScrollView (default true). While Booky's tip floats,
   * the scroll view makes room for it below the content (`useFloatClearance`),
   * so nothing stays stuck under it. A screen with its own scroller does the
   * same there.
   */
  scroll?: boolean;
  /** Safe-area edges to pad. Tab screens skip the bottom edge (the tab bar handles it). */
  edges?: Edge[];
  /** Centre content vertically, useful for empty states. */
  centered?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  testID,
  pageState = 'content',
  scroll = true,
  edges = ['top', 'left', 'right'],
  centered = false,
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const { attach: attachRoom, onLayout: layoutRoom, clearance } = useFloatClearance();
  const main = (
    <View
      role="main"
      testID={testID}
      style={[
        styles.main,
        { padding: theme.spacing.lg, gap: theme.spacing.lg, maxWidth: theme.sizes.contentMaxWidth },
        centered && styles.centered,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View
      testID={Testids.pageState[pageState]}
      style={[styles.fill, { backgroundColor: theme.colors.paper }]}
    >
      <SafeAreaView edges={edges} style={styles.fill}>
        {scroll ? (
          <ScrollView
            ref={attachRoom}
            onLayout={layoutRoom}
            contentContainerStyle={[styles.grow, clearance ? { paddingBottom: clearance } : null]}
            keyboardShouldPersistTaps="handled"
          >
            {main}
          </ScrollView>
        ) : (
          main
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  main: { flexGrow: 1, width: '100%', alignSelf: 'center' },
  centered: { justifyContent: 'center' },
});
