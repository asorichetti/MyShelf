import { useId, useState, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export interface TextFieldProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'onChangeText' | 'value'> {
  /** Visible label; also the input's accessible name. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helperText?: string;
  errorText?: string;
  testID?: string;
  /** The underlying input, e.g. to move focus to the first invalid field. */
  ref?: Ref<TextInput>;
}

export function TextField({ label, value, onChangeText, helperText, errorText, testID, onFocus, onBlur, ref, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const [focused, setFocused] = useState(false);
  const id = useId().replace(/:/g, '');
  const labelId = `tf-label-${id}`;
  const hasError = Boolean(errorText);
  const borderColor = hasError ? colors.danger : focused ? colors.primary : colors.outline;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text nativeID={labelId} variant="label" color={hasError ? 'danger' : 'ink'}>
        {label}
      </Text>
      <TextInput
        {...rest}
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        aria-labelledby={labelId}
        aria-invalid={hasError}
        accessibilityHint={errorText ?? helperText}
        placeholderTextColor={colors.inkMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          theme.typography.body,
          {
            minHeight: rest.multiline ? theme.sizes.touchTarget * 2.5 : theme.sizes.touchTarget,
            paddingVertical: rest.multiline ? spacing.sm : undefined,
            textAlignVertical: rest.multiline ? 'top' : undefined,
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: focused || hasError ? 2 : 1.5,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      />
      {hasError ? (
        <Text variant="caption" color="danger" role="alert">
          {errorText}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="inkMuted">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

