import { hueOf, rainbowRanks } from '../coverOrder';
import { coverPalette, darkCoverPalette } from '../tokens';

describe('the rainbow order of generated bindings', () => {
  it('reads hues off the colour wheel', () => {
    expect(hueOf('#ff0000')).toBe(0);
    expect(hueOf('#00ff00')).toBe(120);
    expect(hueOf('#0000ff')).toBe(240);
    expect(hueOf('#808080')).toBe(0);
  });

  it('ranks every binding once, from red round to magenta', () => {
    const ranks = rainbowRanks();
    expect([...ranks].sort((a, b) => a - b)).toEqual(coverPalette.map((_, i) => i));
    const byRank = coverPalette.map((c, i) => ({ hue: hueOf(c.cloth), rank: ranks[i] })).sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < byRank.length; i++) expect(byRank[i].hue).toBeGreaterThanOrEqual(byRank[i - 1].hue);
  });

  it('puts the dark bindings in nearly the same order: only the three close purples may swap', () => {
    const light = rainbowRanks(coverPalette);
    const dark = rainbowRanks(darkCoverPalette);
    const differ = light.map((r, i) => (r === dark[i] ? null : i)).filter((i) => i != null);
    expect(differ.every((i) => [0, 3, 5].includes(i!))).toBe(true);
  });
});
