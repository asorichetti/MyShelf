import { expect, q, register } from './registry.ts';

register({
  name: 'theme-tokens',
  suite: 'p00',
  desc: 'The theme writes its --ms-* tokens onto :root, and the body background and font come from them',
  async run(c) {
    await c.goto('/');
    const got = await c.page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const token = (n: string) => root.getPropertyValue(n).trim();
      // Resolve the paper token the way the browser paints it (rgb(...)).
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--ms-color-paper)';
      document.body.appendChild(probe);
      const paperRgb = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const body = getComputedStyle(document.body);
      return {
        primary: token('--ms-color-primary'),
        paper: token('--ms-color-paper'),
        paperRgb,
        fontBody: token('--ms-font-body'),
        bodyBackground: body.backgroundColor,
        bodyFont: body.fontFamily,
      };
    });
    expect(got.primary.toUpperCase() === '#6B3FA8', `:root: expected --ms-color-primary ${q('#6B3FA8')}, found ${q(got.primary)}`);
    expect(got.paper !== '', ':root: --ms-color-paper is empty');
    expect(
      got.bodyBackground === got.paperRgb,
      `body: expected background ${q(got.paperRgb)} (--ms-color-paper ${got.paper}), found ${q(got.bodyBackground)}`,
    );
    expect(got.fontBody !== '', ':root: --ms-font-body is empty');
    const unquote = (s: string) => s.replace(/["']/g, '').trim();
    expect(
      unquote(got.bodyFont).startsWith(unquote(got.fontBody)),
      `body: expected font-family to start with --ms-font-body ${q(got.fontBody)}, found ${q(got.bodyFont)}`,
    );
  },
});
