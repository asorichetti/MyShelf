import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { useBlockingLayer } from './layers';
import { menuKeyProps, modalProps, useReturnFocus } from './modalA11y';
import { Scrim } from './Scrim';
import { Text } from './Text';

import type { IconName } from './IconButton';

export interface MenuItem {
  label: string;
  onPress: () => void;
  icon?: IconName;
  destructive?: boolean;
  testID?: string;
}

export interface MenuProps {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  /** Accessible name of the menu (e.g. "More actions for Dune"). */
  accessibilityLabel: string;
  /** Distance from the top of the safe area to the menu's top edge. */
  top?: number;
  testID?: string;
}

/**
 * A small overflow menu anchored to the top-right corner, over a light scrim.
 * Items are 48 dp tall; choosing one closes the menu first and runs the item
 * on the next frame, once focus is back on the menu button (so a dialog the
 * item opens can take focus cleanly). Android back,
 * Escape on web and a tap outside close it (the web Modal also traps focus
 * and returns it to the button that opened the menu).
 */
export function Menu({ visible, onClose, items, accessibilityLabel, top = 56, testID }: MenuProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const insets = useSafeAreaInsets();
  useBlockingLayer(visible);
  useReturnFocus(visible);
  return (
    <Modal {...modalProps(accessibilityLabel)} visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View
        role="menu"
        aria-label={accessibilityLabel}
        {...menuKeyProps()}
        testID={testID}
        style={[
          styles.menu,
          {
            top: insets.top + top,
            right: spacing.md + insets.right,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingVertical: spacing.xs,
            boxShadow: theme.elevation.raised,
          },
        ]}
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            role="menuitem"
            accessibilityLabel={item.label}
            testID={item.testID}
            onPress={() => {
              onClose();
              requestAnimationFrame(() => item.onPress());
            }}
            style={({ pressed }) => [
              styles.item,
              { minHeight: sizes.touchTarget, paddingHorizontal: spacing.lg, gap: spacing.md },
              pressed && { backgroundColor: item.destructive ? colors.dangerContainer : colors.surfaceTint },
            ]}
          >
            {item.icon ? (
              <MaterialCommunityIcons name={item.icon} size={sizes.icon} color={item.destructive ? colors.danger : colors.inkMuted} />
            ) : null}
            <Text variant="bodyStrong" color={item.destructive ? 'danger' : 'ink'}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {/* After the menu in the DOM, so the web focus trap starts on the first item. */}
      <Scrim style={{ backgroundColor: colors.scrim, opacity: 0.4 }} onPress={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: { position: 'absolute', minWidth: 200, borderWidth: 1, zIndex: 1 },
  item: { flexDirection: 'row', alignItems: 'center' },
});
