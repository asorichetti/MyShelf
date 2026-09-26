import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

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

export function TabsLayout() {
  const theme = useTheme();
  const { colors, fonts } = theme;
  return (
    <View style={styles.fill}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarActiveBackgroundColor: colors.surfaceTint,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
          tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
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
  tipHost: { bottom: 72 },
});
