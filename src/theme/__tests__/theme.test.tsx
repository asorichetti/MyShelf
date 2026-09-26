import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  contrastRatio,
  lightTheme,
  textPairs,
  themeToCssVariables,
  typography,
  ThemeProvider,
  themes,
  uiPairs,
  useTheme,
} from '@/theme';
import { platformTypography as nativeTypography } from '@/theme/platformTypography';
import { platformTypography as webTypography } from '@/theme/platformTypography.web';

describe('contrastRatio', () => {
  it('matches known WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // #767676 on white is the classic "just passes AA" grey.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#653D9E', '#FBF6EC')).toBeCloseTo(contrastRatio('#FBF6EC', '#653D9E'), 10);
  });

  it('rejects malformed colours', () => {
    expect(() => contrastRatio('purple', '#FFFFFF')).toThrow(/#RRGGBB/);
  });
});

describe('light theme colour pairs', () => {
  const { colors } = lightTheme;

  it.each(textPairs.map(([fg, bg]) => [fg, bg, contrastRatio(colors[fg], colors[bg])]))(
    'text %s on %s meets WCAG AA (ratio %f >= 4.5)',
    (_fg, _bg, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(uiPairs.map(([fg, bg]) => [fg, bg, contrastRatio(colors[fg], colors[bg])]))(
    'UI %s on %s meets 3:1 non-text contrast (ratio %f)',
    (_fg, _bg, ratio) => {
      expect(ratio).toBeGreaterThanOrEqual(3);
    },
  );

  it('covers every on* role with a pair', () => {
    const onRoles = Object.keys(colors).filter((k) => /^on[A-Z]/.test(k));
    const covered = new Set(textPairs.map(([fg]) => fg));
    expect(onRoles.filter((r) => !covered.has(r as never))).toEqual([]);
  });
});

describe('themeToCssVariables', () => {
  it('exposes colour, spacing, radius and font tokens with the --ms- prefix', () => {
    const vars = themeToCssVariables(lightTheme);
    expect(vars['--ms-color-primary']).toBe(lightTheme.colors.primary);
    expect(vars['--ms-color-paper']).toBe(lightTheme.colors.paper);
    expect(vars['--ms-color-on-primary-container']).toBe(lightTheme.colors.onPrimaryContainer);
    expect(vars['--ms-space-lg']).toBe('16px');
    expect(vars['--ms-radius-md']).toBe(`${lightTheme.radii.md}px`);
    expect(vars['--ms-font-heading']).toBe(lightTheme.fonts.heading);
    expect(vars['--ms-text-h1-weight']).toBe('700');
    expect(vars['--ms-size-touch-target']).toBe('48px');
    expect(Object.keys(vars).every((k) => /^--ms-[a-z0-9-]+$/.test(k))).toBe(true);
  });
});

describe('typography', () => {
  it('uses Lora for headings, Nunito for body and Courier Prime for stamps', () => {
    expect(typography.h1.fontFamily).toMatch(/^Lora_/);
    expect(typography.body.fontFamily).toMatch(/^Nunito_/);
    expect(typography.stamp.fontFamily).toMatch(/^CourierPrime_/);
  });

  it('pairs every family with the weight of its font file', () => {
    for (const style of Object.values(typography)) {
      const fileWeight = /_(\d)00/.exec(style.fontFamily)?.[1];
      expect(`${fileWeight}00`).toBe(style.fontWeight);
    }
  });

  it('drops fontWeight on native and keeps it on web', () => {
    expect(nativeTypography(typography).h1).not.toHaveProperty('fontWeight');
    expect(webTypography(typography).h1.fontWeight).toBe('700');
  });

  it('keeps touch targets at 48dp or more', () => {
    expect(lightTheme.sizes.touchTarget).toBeGreaterThanOrEqual(48);
  });
});

describe('ThemeProvider', () => {
  it('provides the light theme by default and keeps a dark hook', () => {
    let seen: unknown;
    function Probe() {
      seen = useTheme();
      return <Text>probe</Text>;
    }
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(seen).toBe(lightTheme);
    expect(themes.dark).toBeDefined();
  });
});
