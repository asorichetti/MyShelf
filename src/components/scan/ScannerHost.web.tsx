import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { TypedCoverTextField, TypedIsbnField } from './WebScanInput';

import type { ScannerHostProps } from './ScannerHost';

export type { ScannerHostProps } from './ScannerHost';

/**
 * The web build's scanner (P03-07): no camera, so typed input feeds the scan
 * session exactly where a barcode or the cover reader would. Labelled as the
 * test harness it is; the web build is not shipped to users (ADR 0002).
 */
export function ScannerHost({ mode, paused, onIsbnText, onCoverText }: ScannerHostProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.note, { gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderColor: colors.border, backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="flask-outline" size={sizes.icon} color={colors.inkMuted} aria-hidden />
        <Text variant="caption" color="inkMuted" style={styles.fill}>
          {mode === 'barcode' ? t('scan.host.webIsbnNote') : t('scan.host.webCoverNote')}
        </Text>
      </View>
      {mode === 'barcode' ? <TypedIsbnField onSubmit={onIsbnText} disabled={paused} /> : <TypedCoverTextField onSubmit={onCoverText} disabled={paused} />}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderStyle: 'dashed' },
  fill: { flex: 1 },
});
