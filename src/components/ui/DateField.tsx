import { useId, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { formatDate, formatTypedDate, isIsoDate, parseTypedDate, today, type IsoDate } from '@/domain';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { IconButton } from './IconButton';
import { hasDatePicker, openDatePicker } from './openDatePicker';
import { Text } from './Text';

export interface DateFieldProps {
  /** Visible label; also the accessible name. */
  label: string;
  /** A `YYYY-MM-DD` date, '' when empty, or the text typed when it is not a date yet. */
  value: string;
  /** Called with the date as `YYYY-MM-DD` when it reads as one, else with the trimmed text ('' when cleared). */
  onChange: (value: string) => void;
  /** Earliest and latest dates the calendar offers. */
  min?: IsoDate;
  max?: IsoDate;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * A calendar date. Type it ("12/10/2026", "12 Oct 2026") or, on Android,
 * pick it from the system calendar with the button beside the field. The
 * chosen date is read back in words under the field so a typed date is never
 * ambiguous. The web build has its own version (`DateField.web.tsx`), a
 * native `<input type="date">`.
 */
export function DateField({ label, value, onChange, min, max, helperText, errorText, disabled = false, testID }: DateFieldProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes } = theme;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => (isIsoDate(value) ? formatTypedDate(value) : value));
  const labelId = `date-label-${useId().replace(/:/g, '')}`;

  // Follow outside changes (a reset, the calendar) without fighting the user's typing.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if ((parseTypedDate(text) ?? text.trim()) !== value) setText(isIsoDate(value) ? formatTypedDate(value) : value);
  }

  const type = (next: string) => {
    setText(next);
    onChange(parseTypedDate(next) ?? next.trim());
  };

  const pick = async () => {
    const chosen = await openDatePicker({ value: isIsoDate(value) ? value : (max && today() > max ? max : today()), min, max });
    if (chosen) onChange(chosen);
  };

  const hasError = Boolean(errorText);
  const readBack = isIsoDate(value) ? formatDate(value) : null;
  const hint = errorText ?? helperText ?? t('ui.dateField.hint');

  return (
    <View style={{ gap: spacing.xs }}>
      <Text nativeID={labelId} variant="label" color={hasError ? 'danger' : 'ink'}>
        {label}
      </Text>
      <View style={[styles.row, { gap: spacing.xs }]}>
        <TextInput
          testID={testID}
          value={text}
          onChangeText={type}
          editable={!disabled}
          accessibilityLabel={label}
          aria-labelledby={labelId}
          aria-invalid={hasError}
          accessibilityHint={hint}
          accessibilityState={{ disabled }}
          placeholder={t('ui.dateField.placeholder')}
          placeholderTextColor={colors.inkMuted}
          inputMode="numeric"
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            theme.typography.body,
            styles.input,
            {
              minHeight: sizes.touchTarget,
              color: colors.ink,
              backgroundColor: colors.surface,
              borderColor: hasError ? colors.danger : focused ? colors.primary : colors.outline,
              borderWidth: focused || hasError ? 2 : 1.5,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
            },
            disabled && styles.disabled,
          ]}
        />
        {hasDatePicker ? (
          <IconButton icon="calendar-month-outline" variant="tonal" accessibilityLabel={t('ui.dateField.calendar', { field: label.toLowerCase() })} onPress={pick} disabled={disabled} />
        ) : null}
      </View>
      {hasError ? (
        <Text variant="caption" color="danger" role="alert">
          {errorText}
        </Text>
      ) : (
        <Text variant="caption" color="inkMuted">
          {readBack ?? helperText ?? t('ui.dateField.hint')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1 },
  disabled: { opacity: 0.5 },
});
