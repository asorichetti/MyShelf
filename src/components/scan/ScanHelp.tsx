import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Booky } from '@/components/booky';
import { Button, Sheet, Text } from '@/components/ui';
import { t } from '@/i18n';
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
  const { spacing } = useTheme();
  return (
    <Sheet
      visible={visible}
      title={t('scan.help.title')}
      onClose={onClose}
      testID={Testids.scan.helpSheet}
      footer={<Button label={t('scan.help.gotIt')} onPress={onClose} testID={Testids.scan.helpClose} />}
    >
      <View style={[styles.row, { gap: spacing.lg }]}>
        <BackCoverDiagram />
        <View style={[styles.fill, { gap: spacing.sm }]}>
          <Text>{t('scan.help.where')}</Text>
          <Text color="inkMuted">{t('scan.help.jacket')}</Text>
        </View>
      </View>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Booky expression="thinking" size={48} animated={false} />
        <Text style={styles.fill}>{t('scan.help.noBarcode')}</Text>
      </View>
      <Text color="inkMuted">{t('scan.help.isbn')}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fill: { flex: 1, minWidth: 160 },
});
