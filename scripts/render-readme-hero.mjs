#!/usr/bin/env node
// Renders the README's hero image, docs/media/hero.webp (P09-08): four of the
// phone screenshots in docs/media/ side by side in simple phone frames on a
// soft lavender wall, with the wordmark, a one-line pitch and Booky.
//
//   npm run media:hero                        writes docs/media/hero.webp
//   node scripts/render-readme-hero.mjs --out <file.png|file.webp>
//
// The screenshots are the app's own captures from the E2E build on a Pixel 7
// emulator (the P09-08 card in docs/plan/phase-09-polish-a11y-release.md says
// how they were taken). Rendering uses the Chromium that Playwright installs for
// the auto test suite (`npm run autotest:install-browser`) and the app's own
// fonts from node_modules/@expo-google-fonts. The page is 1600x900 CSS pixels
// captured at 2x; a .webp output is encoded by `cwebp` (libwebp, e.g.
// `brew install webp`), and `--out <file>.png` writes the PNG as is.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const media = (name) => join(root, 'docs/media', name);
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? join(process.cwd(), process.argv[outArg + 1]) : media('hero.webp');

/** The phones, left to right. */
const phones = ['covers-grid.webp', 'book-detail.webp', 'series-gap.webp', 'dark-shelf.webp'];

const WIDTH = 1600;
const HEIGHT = 900;

const fonts = [
  { family: 'Lora', weight: 700, file: '@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf' },
  { family: 'Nunito', weight: 600, file: '@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf' },
];
const fontFaces = fonts
  .map(({ family, weight, file }) => {
    const data = readFileSync(join(root, 'node_modules', file)).toString('base64');
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${data}) format('truetype');}`;
  })
  .join('\n');

const dataUrl = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const booky = readFileSync(join(root, 'assets/source/booky.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
* { box-sizing: border-box; }
html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
body {
  background: radial-gradient(circle at 18% 22%, #FFFDF8 0, rgba(255,253,248,0) 38%),
              linear-gradient(135deg, #F6F1FC 0%, #E4D6F6 55%, #D2BDEE 100%);
  font-family: 'Nunito', sans-serif; color: #271D38; position: relative;
}
.title { position: absolute; left: 88px; top: 70px; display: flex; align-items: center; gap: 28px; }
.title svg { width: 92px; height: 130px; filter: drop-shadow(0 8px 14px rgba(61,35,99,.25)); }
.title h1 { font-family: 'Lora', serif; font-weight: 700; font-size: 84px; margin: 0; color: #3D2363; letter-spacing: -1px; }
.title p { margin: 6px 0 0; font-size: 28px; color: #4A3F5C; }
.phones { position: absolute; left: 0; right: 0; bottom: -150px; display: flex; justify-content: center; align-items: flex-end; gap: 44px; }
.phone {
  width: 318px; padding: 11px; border-radius: 46px; background: #2A1846;
  box-shadow: 0 30px 60px rgba(42,24,70,.35), inset 0 0 0 2px #43355A;
}
.phone img { display: block; width: 100%; border-radius: 36px; }
.phone:nth-child(1) { transform: translateY(40px); }
.phone:nth-child(2) { transform: translateY(-10px); }
.phone:nth-child(3) { transform: translateY(-10px); }
.phone:nth-child(4) { transform: translateY(40px); }
</style></head><body>
<div class="title">${booky}<div><h1>MyShelf</h1><p>Your personal library, one shelf at a time.</p></div></div>
<div class="phones">${phones.map((p) => `<div class="phone"><img src="${dataUrl(media(p), 'image/webp')}"></div>`).join('')}</div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.evaluate(async (families) => {
    await Promise.all(families.map((f) => document.fonts.load(`${f.weight} 16px ${f.family}`)));
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  }, fonts);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  if (out.endsWith('.webp')) {
    const tmp = join(tmpdir(), `myshelf-hero-${process.pid}.png`);
    writeFileSync(tmp, png);
    try {
      execFileSync('cwebp', ['-quiet', '-q', '88', '-m', '6', tmp, '-o', out]);
    } finally {
      rmSync(tmp, { force: true });
    }
  } else {
    writeFileSync(out, png);
  }
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
