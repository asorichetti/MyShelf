import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { useTheme, type ColorTokens } from '@/theme';

import { useBookyMode } from './BookyProvider';
import { expressionDescriptions, type BookyExpression } from './expressions';
import { useBookyMotion } from './useBookyMotion';

export interface BookyProps {
  expression?: BookyExpression;
  /** Rendered width in points; height follows the 120x170 artwork ratio. */
  size?: number;
  /** Gentle idle bob and blink. Always off when the OS asks for reduced motion. */
  animated?: boolean;
  /** Overrides the default accessible description. */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const VIEW_W = 120;
const VIEW_H = 170;
const EYE_L = { x: 46, y: 60 };
const EYE_R = { x: 74, y: 60 };

/** Booky: a friendly purple ribbon bookmark with a notched tail. */
export function Booky({ expression = 'happy', size = 120, animated = true, accessibilityLabel, testID, style }: BookyProps) {
  const { colors } = useTheme();
  const mode = useBookyMode();
  const { translateY, blinking } = useBookyMotion(animated && mode !== 'off');
  const label = accessibilityLabel ?? `Booky the bookmark, ${expressionDescriptions[expression]}`;
  // Booky Off (P07-06): the character stays out of sight everywhere.
  if (mode === 'off') return null;

  return (
    <Animated.View
      role="img"
      accessible
      accessibilityLabel={label}
      aria-label={label}
      testID={testID}
      style={[{ width: size, height: (size * VIEW_H) / VIEW_W, transform: [{ translateY }] }, style]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden>
        <Body colors={colors} />
        <Face colors={colors} expression={expression} blinking={blinking} />
      </Svg>
    </Animated.View>
  );
}

function Body({ colors }: { colors: ColorTokens }) {
  return (
    <G>
      {/* Tassel cord and bead */}
      <Path d="M60 18 C 60 8, 70 3, 76 9" stroke={colors.accent} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={77} cy={11} r={4.5} fill={colors.accent} />
      {/* Ribbon body with notched tail */}
      <Path d="M24 26 Q24 17 33 17 H87 Q96 17 96 26 V160 L60 134 L24 160 Z" fill={colors.bookyBody} />
      {/* Right-hand fold shading */}
      <Path d="M84 17 H87 Q96 17 96 26 V160 L84 151 Z" fill={colors.bookyShade} opacity={0.45} />
      {/* Ribbon stitching */}
      <Path
        d="M31 26 V148 M89 26 V148"
        stroke={colors.bookyStitch}
        strokeWidth={1.6}
        strokeDasharray="4 4"
        strokeLinecap="round"
        opacity={0.8}
      />
    </G>
  );
}

function Eye({ cx, cy, colors, dx = 0, dy = 0, big = false }: { cx: number; cy: number; colors: ColorTokens; dx?: number; dy?: number; big?: boolean }) {
  const r = big ? 7.5 : 6.5;
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={big ? 12 : 11} ry={big ? 13.5 : 12.5} fill={colors.bookyEye} />
      <Circle cx={cx + dx} cy={cy + dy} r={r} fill={colors.bookyPupil} />
      <Circle cx={cx + dx + 2.5} cy={cy + dy - 3} r={2.4} fill={colors.bookyEye} />
      {big ? <Circle cx={cx + dx - 2.5} cy={cy + dy + 2.5} r={1.2} fill={colors.bookyEye} /> : null}
    </G>
  );
}

/** Closed eyes for a blink: two soft lids where the eyes are. */
function Blink({ colors }: { colors: ColorTokens }) {
  const lid = { stroke: colors.bookyPupil, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <G>
      <Ellipse cx={EYE_L.x} cy={EYE_L.y} rx={11} ry={12.5} fill={colors.bookyBody} />
      <Ellipse cx={EYE_R.x} cy={EYE_R.y} rx={11} ry={12.5} fill={colors.bookyBody} />
      <Path d={`M${EYE_L.x - 9} ${EYE_L.y + 1} Q${EYE_L.x} ${EYE_L.y + 6} ${EYE_L.x + 9} ${EYE_L.y + 1}`} {...lid} />
      <Path d={`M${EYE_R.x - 9} ${EYE_R.y + 1} Q${EYE_R.x} ${EYE_R.y + 6} ${EYE_R.x + 9} ${EYE_R.y + 1}`} {...lid} />
    </G>
  );
}

function Face({ colors, expression, blinking = false }: { colors: ColorTokens; expression: BookyExpression; blinking?: boolean }) {
  return (
    <G>
      <Features colors={colors} expression={expression} />
      {/* Sleepy Booky's eyes are closed already. */}
      {blinking && expression !== 'sleepy' ? <Blink colors={colors} /> : null}
    </G>
  );
}

function Features({ colors, expression }: { colors: ColorTokens; expression: BookyExpression }) {
  const ink = colors.bookyPupil;
  const line = { stroke: ink, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };
  const cheeks = (
    <G opacity={0.85}>
      <Ellipse cx={37} cy={79} rx={6.5} ry={3.8} fill={colors.bookyCheek} />
      <Ellipse cx={83} cy={79} rx={6.5} ry={3.8} fill={colors.bookyCheek} />
    </G>
  );

  switch (expression) {
    case 'thinking':
      return (
        <G>
          <Eye cx={EYE_L.x} cy={EYE_L.y} dx={3} dy={-4} colors={colors} />
          <Eye cx={EYE_R.x} cy={EYE_R.y} dx={3} dy={-4} colors={colors} />
          <Path d="M37 44 L55 44" {...line} />
          <Path d="M65 41 Q74 35 83 40" {...line} />
          {cheeks}
          <Path d="M54 84 Q60 81 67 84" {...line} />
          <Circle cx={100} cy={40} r={2.5} fill={colors.bookyShade} />
          <Circle cx={106} cy={31} r={3.5} fill={colors.bookyShade} />
        </G>
      );
    case 'excited':
      return (
        <G>
          <Eye cx={EYE_L.x} cy={EYE_L.y} colors={colors} big />
          <Eye cx={EYE_R.x} cy={EYE_R.y} colors={colors} big />
          <Path d="M37 40 Q46 34 55 40" {...line} />
          <Path d="M65 40 Q74 34 83 40" {...line} />
          {cheeks}
          <Path d="M49 78 Q60 96 71 78 Z" fill={ink} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
          <Ellipse cx={60} cy={87} rx={5} ry={2.6} fill={colors.bookyCheek} />
          <Path d="M104 30 L106 36 L112 38 L106 40 L104 46 L102 40 L96 38 L102 36 Z" fill={colors.accent} />
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d="M36 60 Q46 67 56 60" {...line} />
          <Path d="M64 60 Q74 67 84 60" {...line} />
          {cheeks}
          <Ellipse cx={60} cy={83} rx={3.5} ry={4.5} fill={ink} />
          <Path d="M96 26 H104 L96 34 H104" {...line} strokeWidth={2.4} />
          <Path d="M106 14 H111 L106 19 H111" {...line} strokeWidth={2} />
        </G>
      );
    case 'concerned':
      return (
        <G>
          <Eye cx={EYE_L.x} cy={EYE_L.y} dy={2} colors={colors} />
          <Eye cx={EYE_R.x} cy={EYE_R.y} dy={2} colors={colors} />
          <Path d="M37 44 L54 39" {...line} />
          <Path d="M66 39 L83 44" {...line} />
          {cheeks}
          <Path d="M51 86 Q60 78 69 86" {...line} />
        </G>
      );
    case 'happy':
    default:
      return (
        <G>
          <Eye cx={EYE_L.x} cy={EYE_L.y} dy={1} colors={colors} />
          <Eye cx={EYE_R.x} cy={EYE_R.y} dy={1} colors={colors} />
          {cheeks}
          <Path d="M51 79 Q60 88 69 79" {...line} />
        </G>
      );
  }
}
