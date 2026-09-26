import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useId, useState, type Ref } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Heading } from './Heading';
import { Text } from './Text';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Shown when nothing is chosen; also offered as a "none" choice. */
  placeholder?: string;
  errorText?: string;
  testID?: string;
  ref?: Ref<View>;
  /** Offer the "none" choice (the placeholder) at the top of the list. Default true; turn off when a value is required. */
  allowNone?: boolean;
  /** A line under the field explaining it. */
  helperText?: string;
}

/**
 * A field that opens a list to pick one value from (e.g. a language). The
 * trigger is a 48 dp button naming the field and its value; the list is a
 * modal of radio options with a "none" choice at the top.
 */
export function SelectField({ label, value, options, onChange, placeholder = 'Not set', errorText, testID, ref, allowNone = true, helperText }: SelectFieldProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const [open, setOpen] = useState(false);
  const labelId = `select-label-${useId().replace(/:/g, '')}`;
  const current = options.find((o) => o.value === value);
  const choose = (v: string) => {
    setOpen(false);
    onChange(v);
  };
  const choices: SelectOption[] = allowNone ? [{ value: '', label: placeholder }, ...options] : [...options];

  return (
    <View style={{ gap: spacing.xs }}>
      <Text nativeID={labelId} variant="label" color={errorText ? 'danger' : 'ink'}>
        {label}
      </Text>
      <Pressable
        ref={ref}
        role="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityHint={errorText ?? 'Opens a list to choose from'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPress={() => setOpen(true)}
        testID={testID}
        style={({ pressed }) => [
          styles.trigger,
          {
            minHeight: sizes.touchTarget,
            borderRadius: radii.md,
            borderWidth: errorText ? 2 : 1.5,
            borderColor: errorText ? colors.danger : colors.outline,
            backgroundColor: pressed ? colors.surfaceTint : colors.surface,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <Text color={current ? 'ink' : 'inkMuted'} style={styles.flex}>
          {current?.label ?? placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={sizes.icon} color={colors.inkMuted} />
      </Pressable>
      {errorText ? (
        <Text variant="caption" color="danger" role="alert">
          {errorText}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="inkMuted">
          {helperText}
        </Text>
      ) : null}
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View style={[styles.backdrop, { backgroundColor: colors.scrim, padding: spacing.lg }]}>
          <View
            role="dialog"
            aria-modal
            aria-label={label}
            style={[styles.sheet, { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, maxWidth: sizes.bubbleMaxWidth - 120, boxShadow: theme.elevation.raised }]}
          >
            <Heading level={2}>{label}</Heading>
            <ScrollView role="radiogroup" aria-label={label} style={styles.list}>
              {choices.map((o) => {
                const selected = o.value === value;
                return (
                  <Pressable
                    key={o.value || 'none'}
                    role="radio"
                    aria-checked={selected}
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={o.label}
                    onPress={() => choose(o.value)}
                    style={({ pressed }) => [
                      styles.option,
                      { minHeight: sizes.touchTarget, paddingHorizontal: spacing.sm, gap: spacing.md, borderRadius: radii.sm },
                      (pressed || selected) && { backgroundColor: colors.surfaceTint },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={sizes.icon}
                      color={selected ? colors.primary : colors.outline}
                    />
                    <Text variant={selected ? 'bodyStrong' : 'body'} color={o.value ? 'ink' : 'inkMuted'}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button variant="secondary" label="Close" onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end' }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  trigger: { flexDirection: 'row', alignItems: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: { width: '100%', maxHeight: '85%' },
  list: { flexGrow: 0 },
  option: { flexDirection: 'row', alignItems: 'center' },
});
