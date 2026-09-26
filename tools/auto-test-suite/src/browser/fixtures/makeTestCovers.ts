// Generates the synthetic test covers the suite serves in place of
// covers.openlibrary.org (see ../covers.ts): plain shapes and colours, no real
// cover art. Run once from the repository root and commit the JPEGs:
//   npx tsx tools/auto-test-suite/src/browser/fixtures/makeTestCovers.ts
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));

// A 2:3 "cover": a plum board, a berry disc, brass bands and a label block.
const cover = `
  <div style="width:200px;height:300px;background:#512F82;position:relative;overflow:hidden;font-family:sans-serif">
    <div style="position:absolute;left:0;top:0;width:14px;height:300px;background:#3D2363"></div>
    <div style="position:absolute;left:28px;right:14px;top:28px;height:6px;background:#D9B97A"></div>
    <div style="position:absolute;left:28px;right:14px;top:40px;height:2px;background:#D9B97A"></div>
    <div style="position:absolute;left:58px;top:92px;width:96px;height:96px;border-radius:50%;background:#A8336B"></div>
    <div style="position:absolute;left:80px;top:114px;width:52px;height:52px;border-radius:50%;background:#FBE3EE"></div>
    <div style="position:absolute;left:40px;right:26px;top:214px;height:40px;background:#FFFDF8;color:#271D38;font-size:14px;font-weight:700;letter-spacing:2px;line-height:40px;text-align:center">TEST</div>
    <div style="position:absolute;left:28px;right:14px;bottom:18px;height:6px;background:#D9B97A"></div>
  </div>`;

// A padded scan: the same cover centred on a white 300x300 square.
const padded = `<div style="width:300px;height:300px;background:#FFFFFF;display:flex;justify-content:center">${cover}</div>`;

const browser = await chromium.launch();
for (const [name, html, width, height] of [
  ['test-cover.jpg', cover, 200, 300],
  ['test-cover-padded.jpg', padded, 300, 300],
] as const) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<body style="margin:0">${html}</body>`);
  await page.screenshot({ path: join(here, name), type: 'jpeg', quality: 80 });
  await page.close();
}
await browser.close();
