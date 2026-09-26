import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, useIsFocused } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookyTipHost } from '@/components/booky';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const tabs: { name: string; title: string; icon: IconName; testID: string }[] = [
  { name: 'index', title: 'Shelf', icon: 'bookshelf', testID: Testids.nav.tabShelf },
  { name: 'scan', title: 'Scan', icon: 'barcode-scan', testID: Testids.nav.tabScan },
  { name: 'loans', title: 'Loans', icon: 'book-clock-outline', testID: Testids.nav.tabLoans },
  { name: 'groups', title: 'Groups', icon: 'tag-multiple-outline', testID: Testids.nav.tabGroups },
  { name: 'settings', title: 'Settings', icon: 'cog-outline', testID: Testids.nav.tabSettings },
];

/**
 * Renders a tab's screen only while it is focused. Inactive tabs are otherwise
 * kept mounted (on web: in the DOM, merely stacked behind), which would leave
 * several h1s and page-state markers in the document at once. Tab screens hold
 * no state worth keeping yet; revisit if one needs to preserve scroll position.
 */
function FocusedTabScene({ children }: { children: ReactNode }) {
  return useIsFocused() ? <>{children}</> : null;
}

export function TabsLayout() {
  const theme = useTheme();
  const { colors, fonts } = theme;
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.fill}>
      <Tabs
        screenLayout={({ children }) => <FocusedTabScene>{children}</FocusedTabScene>}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarActiveBackgroundColor: colors.surfaceTint,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 64 + insets.bottom,
            paddingTop: 4,
            paddingBottom: 6 + insets.bottom,
          },
          tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
          sceneStyle: { backgroundColor: colors.paper },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarAccessibilityLabel: tab.title,
              tabBarButtonTestID: tab.testID,
              tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={tab.icon} size={size} color={color} />,
            }}
          />
        ))}
      </Tabs>
      <BookyTipHost style={styles.tipHost} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Float the tip above the tab bar.
  tipHost: { bottom: 76 },
});
