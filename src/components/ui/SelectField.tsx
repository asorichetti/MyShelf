import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useId, useRef, useState, type Ref } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { focusView } from './focusView';
import { Heading } from './Heading';
import { useBlockingLayer } from './layers';
import { modalProps, useReturnFocus } from './modalA11y';
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
export function SelectField({ label, value, options, onChange, placeholder: placeholderProp, errorText, testID, ref, allowNone = true, helperText }: SelectFieldProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const placeholder = placeholderProp ?? t('ui.select.notSet');
  const [open, setOpen] = useState(false);
  useBlockingLayer(open);
  useReturnFocus(open);
  // The list opens on the current choice, as a native picker does, rather than on its first line.
  const chosen = useRef<View>(null);
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
        accessibilityLabel={t('ui.select.value', { label, value: current?.label ?? placeholder })}
        accessibilityHint={errorText ?? t('ui.select.hint')}
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
      <Modal
        {...modalProps(label)}
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
        onShow={() => focusView(chosen.current)}
      >
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
                    ref={selected ? chosen : undefined}
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
            <Button variant="secondary" label={t('common.close')} onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end' }} />
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
