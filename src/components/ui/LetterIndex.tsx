import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Text } from './Text';

export interface LetterIndexProps {
  /** Letters that have entries, in order (e.g. "A", "C", "P", "#"). */
  letters: readonly string[];
  /** The letter currently in view, if known. */
  current?: string | null;
  onSelect: (letter: string) => void;
  /** Accessible name of the whole index. */
  accessibilityLabel?: string;
  testID?: string;
}

const letterName = (l: string) => (l === '#' ? t('ui.letterIndex.numbersAndSymbols') : l);

/**
 * A fast-scroll letter index: one 48 dp button per letter that has entries,
 * wrapping onto more rows on narrow screens. Each is labelled "Jump to P".
 */
export function LetterIndex({ letters, current, onSelect, accessibilityLabel, testID }: LetterIndexProps) {
  const { colors, spacing, radii, sizes } = useTheme();
  return (
    <View role="toolbar" aria-label={accessibilityLabel ?? t('ui.letterIndex.label')} style={[styles.row, { gap: spacing.xxs }]}>
      {letters.map((letter) => {
        const active = letter === current;
        return (
          <Pressable
            key={letter}
            role="button"
            accessibilityLabel={t('ui.letterIndex.jumpTo', { letter: letterName(letter) })}
            aria-current={active ? 'true' : undefined}
            onPress={() => onSelect(letter)}
            testID={testID}
            style={({ pressed }) => [
              styles.letter,
              {
                minWidth: sizes.touchTarget,
                minHeight: sizes.touchTarget,
                borderRadius: radii.md,
                backgroundColor: active ? colors.primary : pressed ? colors.surfaceTint : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text variant="bodyStrong" color={active ? 'onPrimary' : 'primary'}>
              {letter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  letter: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
