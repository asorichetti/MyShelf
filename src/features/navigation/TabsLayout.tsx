import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, useIsFocused } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookyTipHost } from '@/components/booky';
import { useOverdueCount } from '@/features/loans/useLoans';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import type { ComponentProps, ReactNode } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const tabs: { name: string; title: string; icon: IconName; testID: string }[] = [
  { name: 'index', title: 'Shelf', icon: 'bookshelf', testID: Testids.tabs.shelf },
  { name: 'scan', title: 'Scan', icon: 'barcode-scan', testID: Testids.tabs.scan },
  { name: 'loans', title: 'Loans', icon: 'book-clock-outline', testID: Testids.tabs.loans },
  { name: 'groups', title: 'Groups', icon: 'tag-multiple-outline', testID: Testids.tabs.groups },
  { name: 'settings', title: 'Settings', icon: 'cog-outline', testID: Testids.tabs.settings },
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
  const { colors, spacing, sizes, typography } = theme;
  const insets = useSafeAreaInsets();
  const overdue = useOverdueCount();
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
            height: sizes.tabBar + insets.bottom,
            paddingTop: spacing.xs,
            paddingBottom: spacing.sm + insets.bottom,
          },
          tabBarItemStyle: { minHeight: sizes.touchTarget },
          tabBarLabelStyle: typography.tabLabel,
          sceneStyle: { backgroundColor: colors.paper },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarAccessibilityLabel: tab.name === 'loans' && overdue ? `${tab.title}, ${overdue} overdue` : tab.title,
              tabBarBadge: tab.name === 'loans' && overdue ? overdue : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.onDanger },
              tabBarButtonTestID: tab.testID,
              tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={tab.icon} size={size} color={color} />,
            }}
          />
        ))}
      </Tabs>
      {/* Float Booky's tips just above the tab bar. */}
      <BookyTipHost style={{ bottom: sizes.tabBar + insets.bottom + spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
