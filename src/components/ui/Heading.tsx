import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { useTheme, type ColorRole } from '@/theme';

import type { ReactNode } from 'react';

export type HeadingLevel = 1 | 2 | 3;

export interface HeadingProps {
  children: ReactNode;
  /** Semantic level; maps to h1..h3 on web. Each screen should have exactly one level 1. */
  level?: HeadingLevel;
  color?: ColorRole;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  testID?: string;
  numberOfLines?: number;
  /** Id other elements can point at (e.g. a dialog's aria-labelledby). */
  nativeID?: string;
  /** Spoken name when the visible text reads badly ("Fantasy · 23" -> "Fantasy, 23 books"). */
  accessibilityLabel?: string;
}

const variants = { 1: 'h1', 2: 'h2', 3: 'h3' } as const;

export function Heading({ children, level = 1, color, align, style, testID, numberOfLines, nativeID, accessibilityLabel }: HeadingProps) {
  const theme = useTheme();
  const type = theme.typography[variants[level]];
  const tone: ColorRole = color ?? (level === 1 ? 'primary' : 'ink');
  return (
    <RNText
      role="heading"
      aria-level={level}
      testID={testID}
      nativeID={nativeID}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={numberOfLines}
      style={[type, { color: theme.colors[tone], textAlign: align }, style]}
    >
      {children}
    </RNText>
  );
}
