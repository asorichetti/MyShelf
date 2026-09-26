import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, useIsFocused } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useOverdueCount } from '@/features/loans/useLoans';
import { PendingLookupsProvider } from '@/features/lookup/PendingLookupsProvider';
import { ScreenErrorBoundary } from '@/features/navigation/ScreenErrorBoundary';
import { t, translate, type MessageKey } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { typographyMaxScale, useFontScale, useTheme } from '@/theme';

import type { ComponentProps, ReactNode } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const tabs: { name: string; title: MessageKey; icon: IconName; testID: string }[] = [
  { name: 'index', title: 'navigation.tabs.shelf', icon: 'bookshelf', testID: Testids.tabs.shelf },
  { name: 'scan', title: 'navigation.tabs.scan', icon: 'barcode-scan', testID: Testids.tabs.scan },
  { name: 'loans', title: 'navigation.tabs.loans', icon: 'book-clock-outline', testID: Testids.tabs.loans },
  { name: 'groups', title: 'navigation.tabs.groups', icon: 'tag-multiple-outline', testID: Testids.tabs.groups },
  { name: 'settings', title: 'navigation.tabs.settings', icon: 'cog-outline', testID: Testids.tabs.settings },
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

/** The tab shell, with the offline lookup queue and the cover backfill running under it. */
export function TabsLayout() {
  return (
    <PendingLookupsProvider>
      <TabsShell />
    </PendingLookupsProvider>
  );
}

function TabsShell() {
  const theme = useTheme();
  const { colors, spacing, sizes, typography } = theme;
  const insets = useSafeAreaInsets();
  const overdue = useOverdueCount();
  // Labels grow with the font size up to their cap, so the bar grows with them instead of clipping them.
  const labelScale = Math.min(useFontScale(), typographyMaxScale.tabLabel ?? 1);
  const labelGrowth = Math.max(0, Math.ceil(typography.tabLabel.lineHeight * (labelScale - 1)));
  return (
    <View style={styles.fill}>
      <Tabs
        // Each tab has its own error boundary, inside the focus gate so a crashed tab starts afresh when revisited.
        screenLayout={({ route, children }) => (
          <FocusedTabScene>
            <ScreenErrorBoundary name={route.name}>{children}</ScreenErrorBoundary>
          </FocusedTabScene>
        )}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarActiveBackgroundColor: colors.surfaceTint,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: sizes.tabBar + labelGrowth + insets.bottom,
            paddingTop: spacing.xs,
            paddingBottom: spacing.sm + insets.bottom,
          },
          tabBarItemStyle: { minHeight: sizes.touchTarget },
          // Our own Text, so the label keeps its font size cap on Android too.
          tabBarLabel: ({ color, children }) => (
            <Text variant="tabLabel" numberOfLines={1} align="center" style={{ color }}>
              {children}
            </Text>
          ),
          sceneStyle: { backgroundColor: colors.paper },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: translate(tab.title),
              tabBarAccessibilityLabel: tab.name === 'loans' && overdue ? t('navigation.tabs.loansOverdue', { tab: translate(tab.title), count: overdue }) : translate(tab.title),
              tabBarBadge: tab.name === 'loans' && overdue ? overdue : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.onDanger },
              tabBarButtonTestID: tab.testID,
              tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={tab.icon} size={size} color={color} />,
            }}
          />
        ))}
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
