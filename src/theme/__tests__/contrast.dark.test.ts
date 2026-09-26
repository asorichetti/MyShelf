import {
  contrastRatio,
  darkGroupSwatches,
  darkTheme,
  groupSwatch,
  groupSwatches,
  groupSwatchesFor,
  lightTheme,
  relativeLuminance,
  textPairs,
  themes,
  themeToCssVariables,
  uiPairs,
} from '@/theme';

/** The dark theme (P09-02) is held to the same contrast rules as the light one. */
describe('dark theme colour pairs', () => {
  const { colors } = darkTheme;

  it('is registered as the dark scheme', () => {
    expect(themes.dark).toBe(darkTheme);
    expect(darkTheme.scheme).toBe('dark');
    expect(darkTheme.typography).toBe(lightTheme.typography);
    expect(darkTheme.spacing).toBe(lightTheme.spacing);
  });

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

  it('defines every colour role', () => {
    expect(Object.keys(colors).sort()).toEqual(Object.keys(lightTheme.colors).sort());
    for (const [role, value] of Object.entries(colors)) {
      if (role === 'scrim') expect(value).toMatch(/^rgba\(/);
      else expect(value).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('is a night library, not pure black: dark grounds, light ink, cards a step up from the paper', () => {
    for (const ground of [colors.paper, colors.surface, colors.surfaceTint]) {
      expect(relativeLuminance(ground)).toBeLessThan(0.05);
      expect(relativeLuminance(ground)).toBeGreaterThan(0.005);
    }
    expect(relativeLuminance(colors.surface)).toBeGreaterThan(relativeLuminance(colors.paper));
    expect(relativeLuminance(colors.surfaceTint)).toBeGreaterThan(relativeLuminance(colors.surface));
    expect(relativeLuminance(colors.ink)).toBeGreaterThan(0.7);
    // Parchment ink, not blue-white: more red than blue.
    expect(parseInt(colors.ink.slice(1, 3), 16)).toBeGreaterThan(parseInt(colors.ink.slice(5, 7), 16));
  });

  it.each(darkTheme.covers.map((c, i) => [i, c.cloth, contrastRatio(c.ink, c.cloth), contrastRatio(c.cloth, colors.surface)]))(
    'generated cover %i (%s): ink meets WCAG AA (%f) and the cloth stands out from the card (%f)',
    (_i, _cloth, ink, card) => {
      expect(ink).toBeGreaterThanOrEqual(4.5);
      expect(card).toBeGreaterThanOrEqual(2);
    },
  );

  it('keeps one cover binding per light binding, so a book keeps its hue', () => {
    expect(darkTheme.covers).toHaveLength(lightTheme.covers.length);
  });

  it.each(darkGroupSwatches.map((s) => [s.label, contrastRatio(s.onBand, s.band)]))('group swatch %s: label text meets WCAG AA (ratio %f)', (_label, ratio) => {
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('offers the same group swatches, by name and order, in both themes', () => {
    expect(darkGroupSwatches.map((s) => [s.name, s.label])).toEqual(groupSwatches.map((s) => [s.name, s.label]));
    expect(groupSwatchesFor('dark')).toBe(darkGroupSwatches);
    expect(groupSwatchesFor('light')).toBe(groupSwatches);
    expect(groupSwatch('sage', 'dark').band).not.toBe(groupSwatch('sage').band);
    expect(groupSwatch('chartreuse', 'dark').name).toBe('lavender');
  });

  it('writes its own values as the --ms-* CSS variables', () => {
    const vars = themeToCssVariables(darkTheme);
    expect(vars['--ms-color-paper']).toBe(colors.paper);
    expect(vars['--ms-color-ink']).toBe(colors.ink);
    expect(vars['--ms-color-primary']).not.toBe(lightTheme.colors.primary);
    expect(vars['--ms-elevation-card']).toBe(darkTheme.elevation.card);
  });
});
