import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Booky } from '@/components/booky';
import { Button, Heading, Text } from '@/components/ui';
import { MODAL_ANIMATION } from '@/components/ui/modalAnimation';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/** A back cover with the barcode in its usual place: bottom right, above the ISBN line. */
function BackCoverDiagram() {
  const { colors } = useTheme();
  const bars = [0, 3, 5, 9, 11, 14, 18, 20, 23, 27, 29, 32, 36, 38];
  return (
    <Svg width={150} height={220} viewBox="0 0 150 220" aria-hidden>
      <Rect x={2} y={2} width={146} height={216} rx={6} fill={colors.primaryContainer} stroke={colors.primary} strokeWidth={2} />
      {[30, 44, 58, 72, 86].map((y) => (
        <Rect key={y} x={18} y={y} width={y === 86 ? 70 : 114} height={6} rx={3} fill={colors.cardLine} />
      ))}
      <Rect x={70} y={150} width={66} height={52} rx={3} fill={colors.surface} stroke={colors.accent} strokeWidth={2} />
      {bars.map((x) => (
        <Rect key={x} x={78 + x} y={158} width={x % 2 ? 1.5 : 2.5} height={30} fill={colors.ink} />
      ))}
    </Svg>
  );
}

/**
 * Scanning help (P03-13): where ISBN barcodes usually are, what to do when
 * there is none, and the cover alternative. Booky's full help arrives in
 * P07-05; this is the Scan tab's part of it.
 */
export function ScanHelp({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const reduceMotion = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : MODAL_ANIMATION} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim, padding: spacing.lg }]}>
        <View
          role="dialog"
          aria-modal
          aria-labelledby="scan-help-title"
          testID={Testids.scan.helpSheet}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.md, maxWidth: theme.sizes.bubbleMaxWidth, boxShadow: theme.elevation.raised }]}
        >
          <View style={[styles.row, { gap: spacing.md }]}>
            <Booky expression="thinking" size={56} animated={false} />
            <Heading level={2} nativeID="scan-help-title" style={styles.fill}>
              Where’s the barcode?
            </Heading>
          </View>
          <View style={[styles.row, { gap: spacing.lg, alignItems: 'center' }]}>
            <BackCoverDiagram />
            <View style={[styles.fill, { gap: spacing.sm }]}>
              <Text>Turn the book over: the ISBN barcode is usually at the bottom of the back cover, starting 978 or 979.</Text>
              <Text color="inkMuted">On a dust jacket, look on the back flap too.</Text>
            </View>
          </View>
          <Text>No barcode (older books often have none)? Switch to Cover and photograph the front: I’ll read the title and author and show you the editions.</Text>
          <Text color="inkMuted">The ISBN (International Standard Book Number) identifies one edition of a book, so a barcode finds exactly your copy.</Text>
          <Button label="Got it" onPress={onClose} testID={Testids.scan.helpClose} style={{ alignSelf: 'flex-end' }} />
        </View>
        <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden focusable={false} style={StyleSheet.absoluteFill} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: { width: '100%', borderWidth: 1, zIndex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fill: { flex: 1, minWidth: 160 },
});
