import { contrastRatio, groupSwatch, groupSwatches } from '@/theme';

describe('group swatches', () => {
  it('offers eight uniquely named swatches', () => {
    expect(groupSwatches).toHaveLength(8);
    expect(new Set(groupSwatches.map((s) => s.name)).size).toBe(8);
    expect(new Set(groupSwatches.map((s) => s.label)).size).toBe(8);
  });

  it.each(groupSwatches.map((s) => [s.label, contrastRatio(s.onBand, s.band)]))('%s: label text meets WCAG AA (ratio %f >= 4.5)', (_label, ratio) => {
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to lavender for unknown colours', () => {
    expect(groupSwatch('sage').label).toBe('Sage');
    expect(groupSwatch('chartreuse').name).toBe('lavender');
    expect(groupSwatch(null).name).toBe('lavender');
  });
});
