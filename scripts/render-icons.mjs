#!/usr/bin/env node
// Renders the app icon, adaptive icon layers, splash image, favicon,
// notification icon and Play Store graphics from the SVG sources in
// assets/source/ (P09-05), so every PNG in assets/ can be rebuilt from
// something reviewable.
//
//   npm run icons:render                     writes the PNGs listed below
//   npm run icons:render -- --preview <dir>  also writes review sheets: the
//     adaptive icon in circle, squircle and rounded-square masks at 192 and
//     48 px, the themed (monochrome) icon, the safe zone and the splash
//
// Rendering uses the Chromium that Playwright already installs for the auto
// test suite (`npm run autotest:install-browser`). The wordmarks use the
// app's own fonts, loaded from node_modules/@expo-google-fonts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (name) => readFileSync(join(root, 'assets/source', name), 'utf8');

/** Every generated image: its SVG source, output path and pixel size. */
const outputs = [
  { src: 'icon.svg', out: 'assets/icon.png', width: 1024, height: 1024 },
  { src: 'adaptive-foreground.svg', out: 'assets/android-icon-foreground.png', width: 1024, height: 1024 },
  { src: 'adaptive-background.svg', out: 'assets/android-icon-background.png', width: 1024, height: 1024 },
  { src: 'adaptive-monochrome.svg', out: 'assets/android-icon-monochrome.png', width: 1024, height: 1024 },
  { src: 'splash.svg', out: 'assets/splash-icon.png', width: 1024, height: 1024 },
  { src: 'splash-dark.svg', out: 'assets/splash-icon-dark.png', width: 1024, height: 1024 },
  { src: 'favicon.svg', out: 'assets/favicon.png', width: 48, height: 48 },
  { src: 'notification-icon.svg', out: 'assets/notification-icon.png', width: 96, height: 96 },
  { src: 'icon.svg', out: 'assets/store/icon-512.png', width: 512, height: 512 },
  { src: 'feature-graphic.svg', out: 'assets/store/feature-graphic.png', width: 1024, height: 500 },
];

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

function page(body, width, height) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
html,body{margin:0;padding:0;background:transparent;}
body>svg,body>div{display:block;width:${width}px;height:${height}px;}
</style></head><body>${body}</body></html>`;
}

/** Renders `body` (an SVG or HTML fragment) to a transparent PNG of the given size. */
async function render(browserPage, body, width, height) {
  await browserPage.setViewportSize({ width, height });
  await browserPage.setContent(page(body, width, height));
  await browserPage.evaluate(async (families) => {
    await Promise.all(families.map((f) => document.fonts.load(`${f.weight} 16px ${f.family}`)));
    await document.fonts.ready;
  }, fonts);
  return browserPage.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } });
}

const dataUrl = (png) => `data:image/png;base64,${png.toString('base64')}`;

/** A superellipse (n = 4) of the given radius around (c, c), close to Pixel's squircle mask. */
function squirclePath(c, r) {
  const points = [];
  for (let i = 0; i < 360; i += 2) {
    const t = (i * Math.PI) / 180;
    const x = Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** 0.5 * r;
    const y = Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 0.5 * r;
    points.push(`${(c + x).toFixed(2)} ${(c + y).toFixed(2)}`);
  }
  return `M${points.join(' L')} Z`;
}

/**
 * The adaptive icon as a launcher would draw it: both layers at 108 units,
 * the central 72 shown, cut to a mask. `layers` are PNG data URLs.
 */
function adaptiveIcon(layers, mask, size, id) {
  const s = size / 72;
  const full = 108 * s;
  const offset = -18 * s;
  const shape =
    mask === 'circle'
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>`
      : mask === 'squircle'
        ? `<path d="${squirclePath(size / 2, size / 2)}"/>`
        : `<rect width="${size}" height="${size}" rx="${size * 0.18}"/>`;
  const images = layers.map((href) => `<image href="${href}" x="${offset}" y="${offset}" width="${full}" height="${full}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><clipPath id="${id}">${shape}</clipPath></defs><g clip-path="url(#${id})">${images}</g></svg>`;
}

async function writePreviews(browserPage, rendered, dir) {
  mkdirSync(dir, { recursive: true });
  const fg = dataUrl(rendered.get('assets/android-icon-foreground.png'));
  const bg = dataUrl(rendered.get('assets/android-icon-background.png'));
  const mono = dataUrl(rendered.get('assets/android-icon-monochrome.png'));
  // Themed icons: the launcher tints the monochrome layer's alpha on a tonal background.
  const tinted = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108"><defs><mask id="m" style="mask-type:alpha"><image href="${mono}" width="108" height="108"/></mask></defs><rect width="108" height="108" fill="#DCE3F5"/><rect width="108" height="108" fill="#23395B" mask="url(#m)"/></svg>`;
  const tintedPng = await render(browserPage, tinted, 108 * 4, 108 * 4);
  writeFileSync(join(dir, 'themed-layer.png'), tintedPng);
  const themed = dataUrl(tintedPng);

  const cells = [];
  let n = 0;
  for (const size of [192, 48]) {
    for (const mask of ['circle', 'squircle', 'rounded']) cells.push(adaptiveIcon([bg, fg], mask, size, `c${n++}`));
    cells.push(adaptiveIcon([themed], 'circle', size, `c${n++}`));
  }
  const sheet = (wallpaper) =>
    `<div style="box-sizing:border-box;background:${wallpaper};padding:24px;display:grid;grid-template-columns:repeat(4,192px);gap:24px;align-items:center;justify-items:center">${cells.join('')}</div>`;
  const [w, h] = [4 * 192 + 5 * 24, 2 * 192 + 3 * 24];
  writeFileSync(join(dir, 'masks-dark.png'), await render(browserPage, sheet('#3a3a3a'), w, h));
  writeFileSync(join(dir, 'masks-light.png'), await render(browserPage, sheet('#f2f2f2'), w, h));

  // Safe zone: the 72dp viewport and the 66dp circle launchers promise to keep.
  const safe = `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 108 108"><image href="${bg}" width="108" height="108"/><image href="${fg}" width="108" height="108"/><rect x="18" y="18" width="72" height="72" fill="none" stroke="#0a0" stroke-width="0.4"/><circle cx="54" cy="54" r="33" fill="none" stroke="#d00" stroke-width="0.4"/></svg>`;
  writeFileSync(join(dir, 'safe-zone.png'), await render(browserPage, safe, 432, 432));

  // Splash as Android 12+ shows it: 200dp image in a 288dp box on paper, cut to a 192dp circle;
  // in light mode on the paper colour, in dark mode on the night paper.
  for (const [image, paper, name] of [
    ['assets/splash-icon.png', '#FBF6EC', 'splash-android12.png'],
    ['assets/splash-icon-dark.png', '#1C1424', 'splash-android12-dark.png'],
  ]) {
    const splash = dataUrl(rendered.get(image));
    const splashView = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640"><rect width="360" height="640" fill="${paper}"/><defs><clipPath id="sc"><circle cx="180" cy="320" r="96"/></clipPath></defs><image href="${splash}" x="80" y="220" width="200" height="200" clip-path="url(#sc)"/></svg>`;
    writeFileSync(join(dir, name), await render(browserPage, splashView, 360, 640));
  }
}

const previewAt = process.argv.indexOf('--preview');
const previewDir = previewAt > -1 ? process.argv[previewAt + 1] : null;
if (previewAt > -1 && !previewDir) {
  process.stderr.write('render-icons: --preview needs a directory\n');
  process.exit(2);
}

const browser = await chromium.launch();
try {
  const browserPage = await browser.newPage({ deviceScaleFactor: 1 });
  const rendered = new Map();
  for (const { src, out, width, height } of outputs) {
    const png = await render(browserPage, source(src), width, height);
    mkdirSync(dirname(join(root, out)), { recursive: true });
    writeFileSync(join(root, out), png);
    rendered.set(out, png);
    process.stdout.write(`${out} (${width}x${height}) from assets/source/${src}\n`);
  }
  if (previewDir) {
    await writePreviews(browserPage, rendered, previewDir);
    process.stdout.write(`previews in ${previewDir}\n`);
  }
} finally {
  await browser.close();
}
