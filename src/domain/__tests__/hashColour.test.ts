import { hashColour, hashString } from '@/domain';

describe('hashColour', () => {
  it('gives the same title the same colour, every time', () => {
    expect(hashColour('Dune', 8)).toBe(hashColour('Dune', 8));
    expect(hashColour('  dune ', 8)).toBe(hashColour('Dune', 8));
  });

  it('matches known FNV-1a values, so colours never change between versions', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
  });

  it('stays in range and spreads titles across the palette', () => {
    const titles = Array.from({ length: 200 }, (_, i) => `Book number ${i}`);
    const used = new Set(titles.map((t) => hashColour(t, 8)));
    for (const i of used) expect(i).toBeGreaterThanOrEqual(0);
    expect(Math.max(...used)).toBeLessThan(8);
    expect(used.size).toBe(8);
  });

  it('rejects an empty palette', () => {
    expect(() => hashColour('Dune', 0)).toThrow(RangeError);
  });
});
