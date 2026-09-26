import { StyleSheet, View } from 'react-native';

import { Spine } from '@/components/book/Spine';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface MiniSpinesProps {
  /** Series name: gives each spine a stable colour. */
  name: string;
  /** Known length of the series (1…total), or null. */
  total: number | null;
  /** Missing whole positions. */
  gaps: readonly number[];
  /** At most this many spines are drawn; the rest are summarised as "+N". */
  max?: number;
}

/**
 * A tiny shelf for a series row: one spine per position, filled when owned
 * and dashed when missing. Decorative: the row's label says the same.
 */
export function MiniSpines({ name, total, gaps, max = 16 }: MiniSpinesProps) {
  const { spacing } = useTheme();
  if (total == null) return null;
  const shown = Math.min(total, max);
  const missing = new Set(gaps);
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.row, { gap: spacing.xxs }]}>
      {Array.from({ length: shown }, (_, i) => i + 1).map((p) => (
        <Spine key={p} size="mini" position={p} variant={missing.has(p) ? 'missing' : 'owned'} colourKey={`${name}#${p}`} />
      ))}
      {total > shown ? (
        <Text variant="caption" color="inkMuted" style={{ marginLeft: spacing.xs }}>
          {`+${total - shown}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
});
