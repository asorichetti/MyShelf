import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorRole, type TypographyVariant } from '@/theme';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  children?: ReactNode;
  /** Typography scale entry. Defaults to `body`. */
  variant?: Exclude<TypographyVariant, 'display' | 'h1' | 'h2' | 'h3'>;
  /** Colour role for the text. Defaults to `ink`. */
  color?: ColorRole;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function Text({ variant = 'body', color = 'ink', align, style, children, ...rest }: TextProps) {
  const theme = useTheme();
  const type = theme.typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        type,
        { color: theme.colors[color], textAlign: align },
        variant === 'stamp' && { textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
