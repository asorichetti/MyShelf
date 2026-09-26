import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export interface ScrimProps {
  /** Called when the scrim is tapped (close the sheet, menu or dialog); leave out to only block taps. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The shade behind a sheet, menu or dialog: a tap on it closes what is
 * open. Hidden from assistive tech (Android back, Escape and each modal's
 * own buttons do the same job) and deliberately not a Pressable: on web a
 * Pressable is always focusable, and react-native-web's focus trap would
 * then land on this empty, unnamed box when Tab wraps round.
 */
export function Scrim({ onPress, style, testID }: ScrimProps) {
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[StyleSheet.absoluteFill, style]}
      onStartShouldSetResponder={() => true}
      onResponderRelease={() => onPress?.()}
    />
  );
}
