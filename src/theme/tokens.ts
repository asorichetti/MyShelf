/**
 * MyShelf design tokens.
 *
 * The palette is a cosy-library purple: warm paper grounds, deep ink text,
 * a plum primary and a berry accent. Every colour that is used for text sits
 * in a named foreground/background pair (see `textPairs`) and every pair is
 * checked for WCAG AA contrast (>= 4.5:1) in the theme tests.
 */

/** Raw palette. Components never use these directly; they use role colours. */
export const palette = {
  plum50: '#F6F1FC',
  plum100: '#ECE2F8',
  plum200: '#D9C7F0',
  plum300: '#BFA3E3',
  plum400: '#9B74CF',
  plum500: '#7B4FB8',
  plum600: '#6B3FA8',
  plum700: '#512F82',
  plum800: '#3D2363',
  plum900: '#2A1846',

  paper50: '#FFFDF8',
  paper100: '#FBF6EC',
  paper200: '#F3EADB',
  paper300: '#E6D8C3',

  ink900: '#271D38',
  ink700: '#4A3F5C',
  ink500: '#6E6380',

  berry100: '#FBE3EE',
  berry600: '#A8336B',
  berry800: '#6F1C45',

  moss100: '#E2F2E7',
  moss700: '#2D6B45',
  moss900: '#1B4429',

  amber100: '#FDF0D5',
  amber700: '#8A5300',
  amber900: '#5C3700',

  rose100: '#FCE4E1',
  rose700: '#B3261E',
  rose900: '#7A1A14',

  white: '#FFFFFF',
  cheek: '#F4A6C6',
} as const;

export interface ColorTokens {
  /** Warm page background, like aged library paper. */
  paper: string;
  /** Raised surfaces: cards, sheets, the tab bar. */
  surface: string;
  /** Subtle tinted surface for grouped or selected content. */
  surfaceTint: string;
  /** Primary body text. */
  ink: string;
  /** Secondary text (captions, helper text). */
  inkMuted: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  accent: string;
  onAccent: string;
  accentContainer: string;
  onAccentContainer: string;
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;
  warn: string;
  onWarn: string;
  warnContainer: string;
  onWarnContainer: string;
  danger: string;
  onDanger: string;
  dangerContainer: string;
  onDangerContainer: string;
  /** Hairlines and card borders (decorative, not text). */
  border: string;
  /** Stronger outline for inputs and focus rings (>= 3:1 on paper). */
  outline: string;
  /** Ruled line across catalogue cards. */
  cardRule: string;
  /** Booky's own colours. */
  bookyBody: string;
  bookyShade: string;
  bookyStitch: string;
  bookyCheek: string;
  bookyEye: string;
  bookyPupil: string;
}

export const lightColors: ColorTokens = {
  paper: palette.paper100,
  surface: palette.paper50,
  surfaceTint: palette.plum50,
  ink: palette.ink900,
  inkMuted: palette.ink700,
  primary: palette.plum600,
  onPrimary: palette.white,
  primaryContainer: palette.plum100,
  onPrimaryContainer: palette.plum800,
  accent: palette.berry600,
  onAccent: palette.white,
  accentContainer: palette.berry100,
  onAccentContainer: palette.berry800,
  success: palette.moss700,
  onSuccess: palette.white,
  successContainer: palette.moss100,
  onSuccessContainer: palette.moss900,
  warn: palette.amber700,
  onWarn: palette.white,
  warnContainer: palette.amber100,
  onWarnContainer: palette.amber900,
  danger: palette.rose700,
  onDanger: palette.white,
  dangerContainer: palette.rose100,
  onDangerContainer: palette.rose900,
  border: palette.paper300,
  outline: palette.ink500,
  cardRule: palette.berry600,
  bookyBody: palette.plum500,
  bookyShade: palette.plum700,
  bookyStitch: palette.plum200,
  bookyCheek: palette.cheek,
  bookyEye: palette.white,
  bookyPupil: palette.plum900,
};

export type ColorRole = keyof ColorTokens;

/**
 * Foreground/background pairs that are used for text. The theme tests assert
 * each one meets WCAG AA for normal text (4.5:1).
 */
export const textPairs: readonly (readonly [fg: ColorRole, bg: ColorRole])[] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink', 'surfaceTint'],
  ['inkMuted', 'paper'],
  ['inkMuted', 'surface'],
  ['inkMuted', 'surfaceTint'],
  ['primary', 'paper'],
  ['primary', 'surface'],
  ['primary', 'surfaceTint'],
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['accent', 'surface'],
  ['onAccent', 'accent'],
  ['onAccentContainer', 'accentContainer'],
  ['success', 'surface'],
  ['onSuccess', 'success'],
  ['onSuccessContainer', 'successContainer'],
  ['warn', 'surface'],
  ['onWarn', 'warn'],
  ['onWarnContainer', 'warnContainer'],
  ['danger', 'paper'],
  ['danger', 'surface'],
  ['onDanger', 'danger'],
  ['onDangerContainer', 'dangerContainer'],
];

/** Non-text UI pairs (outlines, icons) that must reach 3:1 (WCAG 1.4.11). */
export const uiPairs: readonly (readonly [fg: ColorRole, bg: ColorRole])[] = [
  ['outline', 'paper'],
  ['outline', 'surface'],
  ['primary', 'paper'],
  ['bookyShade', 'paper'],
];

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Fixed sizes for layout and touch targets. */
export const sizes = {
  /** Minimum touch target (dp). */
  touchTarget: 48,
  /** Drawn size of a small icon button inside another control (e.g. a bubble's close button); its pressable box stays touchTarget. */
  iconButton: 32,
  icon: 20,
  /** Tab bar height above the bottom safe-area inset. */
  tabBar: 64,
  /** Readable content column on wide screens. */
  contentMaxWidth: 720,
  bubbleMaxWidth: 560,
} as const;

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Font family names as registered by `useFonts` in the root layout: Lora
 * (bookish serif) for headings, Nunito (rounded sans) for body text and
 * Courier Prime (typewriter) for stamps, ISBNs and call numbers.
 */
export const fontFamilies = {
  headingRegular: 'Lora_500Medium',
  heading: 'Lora_600SemiBold',
  headingBold: 'Lora_700Bold',
  body: 'Nunito_400Regular',
  bodyItalic: 'Nunito_400Regular_Italic',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  mono: 'CourierPrime_400Regular',
  monoBold: 'CourierPrime_700Bold',
} as const;

export type FontWeight = '400' | '500' | '600' | '700';

export interface TypeStyle {
  fontFamily: string;
  /** The weight of the font file named by `fontFamily` (see platformTypography). */
  fontWeight: FontWeight;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const typography = {
  display: { fontFamily: fontFamilies.headingBold, fontWeight: '700', fontSize: 34, lineHeight: 42, letterSpacing: -0.3 },
  h1: { fontFamily: fontFamilies.headingBold, fontWeight: '700', fontSize: 28, lineHeight: 36, letterSpacing: -0.2 },
  h2: { fontFamily: fontFamilies.heading, fontWeight: '600', fontSize: 22, lineHeight: 30 },
  h3: { fontFamily: fontFamilies.heading, fontWeight: '600', fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamilies.body, fontWeight: '400', fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamilies.bodyBold, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fontFamilies.bodySemiBold, fontWeight: '600', fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  /** Tab bar labels and other small UI text. */
  tabLabel: { fontFamily: fontFamilies.bodySemiBold, fontWeight: '600', fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: fontFamilies.body, fontWeight: '400', fontSize: 13, lineHeight: 18 },
  /** Typewriter details: ISBNs, call numbers. */
  mono: { fontFamily: fontFamilies.mono, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  /** Uppercase rubber-stamp lettering, e.g. due-date stamps. */
  stamp: { fontFamily: fontFamilies.monoBold, fontWeight: '700', fontSize: 13, lineHeight: 16, letterSpacing: 1 },
} as const satisfies Record<string, TypeStyle>;

export type TypographyVariant = keyof typeof typography;

/** Cross-platform shadows (React Native `boxShadow` strings). */
export const elevation = {
  none: 'none',
  low: '0px 1px 2px rgba(42, 24, 70, 0.10)',
  card: '0px 2px 6px rgba(42, 24, 70, 0.10), 0px 1px 1px rgba(42, 24, 70, 0.06)',
  raised: '0px 6px 16px rgba(42, 24, 70, 0.16)',
} as const;

export type ElevationLevel = keyof typeof elevation;
