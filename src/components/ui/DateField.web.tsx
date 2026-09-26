import { useId, useState } from 'react';
import { View } from 'react-native';

import { formatDate, isIsoDate } from '@/domain';
import { useTheme } from '@/theme';

import { Text } from './Text';

import type { DateFieldProps } from './DateField';

export type { DateFieldProps } from './DateField';

/**
 * Web: the browser's own `<input type="date">`, which is labelled, typeable
 * (the typed fallback) and has an accessible calendar popup. Its value is
 * always `YYYY-MM-DD` or '' (empty or half typed).
 */
export function DateField({ label, value, onChange, min, max, helperText, errorText, disabled = false, testID }: DateFieldProps) {
  const theme = useTheme();
  const { colors, spacing, radii, sizes, typography } = theme;
  const [focused, setFocused] = useState(false);
  const id = useId().replace(/:/g, '');
  const labelId = `date-label-${id}`;
  const noteId = `date-note-${id}`;
  const hasError = Boolean(errorText);
  const readBack = isIsoDate(value) ? formatDate(value) : null;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text nativeID={labelId} variant="label" color={hasError ? 'danger' : 'ink'}>
        {label}
      </Text>
      <input
        type="date"
        data-testid={testID}
        value={isIsoDate(value) ? value : ''}
        min={min}
        max={max}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={noteId}
        aria-invalid={hasError}
        onChange={(e) => onChange(e.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minHeight: sizes.touchTarget,
          fontFamily: typography.body.fontFamily,
          fontSize: typography.body.fontSize,
          lineHeight: `${typography.body.lineHeight}px`,
          color: colors.ink,
          backgroundColor: colors.surface,
          border: `${focused || hasError ? 2 : 1.5}px solid ${hasError ? colors.danger : focused ? colors.primary : colors.outline}`,
          borderRadius: radii.md,
          padding: `0 ${spacing.md}px`,
          outline: 'none',
          opacity: disabled ? 0.5 : 1,
          colorScheme: 'light',
        }}
      />
      {hasError ? (
        <Text nativeID={noteId} variant="caption" color="danger" role="alert">
          {errorText}
        </Text>
      ) : (
        <Text nativeID={noteId} variant="caption" color="inkMuted">
          {readBack ?? helperText ?? 'Type the date or open the calendar'}
        </Text>
      )}
    </View>
  );
}
