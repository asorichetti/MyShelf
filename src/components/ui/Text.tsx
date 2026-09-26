import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useLineClamp } from '@/hooks/useLineClamp';
import { typographyMaxScale, useTheme, type ColorRole, type TypographyVariant } from '@/theme';

import type { ReactNode } from 'react';

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

export function Text({ variant = 'body', color = 'ink', align, style, children, numberOfLines, ...rest }: TextProps) {
  const theme = useTheme();
  // A clamp shows as much text at a large font size as at 100 % (more lines, not fewer words).
  const lines = useLineClamp(numberOfLines ?? 0, typographyMaxScale[variant]);
  const type = theme.typography[variant];
  return (
    <RNText
      // A few variants stop growing before the system's largest font size (see typographyMaxScale).
      maxFontSizeMultiplier={typographyMaxScale[variant]}
      {...rest}
      numberOfLines={numberOfLines ? lines : undefined}
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
