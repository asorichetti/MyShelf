import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** A typed spine label with the book's call number, e.g. "FIC PRA 1987". */
export function CallNumber({ value, testID }: { value: string; testID?: string }) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      testID={testID}
      style={[styles.label, { borderColor: colors.accent, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, backgroundColor: colors.surface }]}
    >
      <Text variant="stamp" color="accent">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed' },
});
