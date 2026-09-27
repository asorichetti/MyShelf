#!/usr/bin/env node
// Renders a made-up book cover, for the Maestro flow that reads a cover from
// the gallery where the developer's own photos are not available (CI, a fresh
// clone): .maestro/cover-scan-synthetic.yaml. The lettering is the title and
// author of a real book, so on-device text recognition and the catalogue
// search have something true to find; the artwork is plain shapes, ours.
//
//   node scripts/make-synthetic-cover.mjs [out.jpg]
//     (default .maestro/cover-scan/synthetic-colour-of-magic.jpg, committed)
//
// A JPEG straight from Chromium carries no capture date, so the phone's photo
// picker lists it first, where the flow taps. Needs Playwright's Chromium
// (npm run autotest:install-browser).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(root, '.maestro/cover-scan/synthetic-colour-of-magic.jpg');

// A photo of a cover on a table: the cover a little smaller than the frame.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1200px;height:1600px;background:#8a7a66;}
.cover{position:absolute;left:150px;top:150px;width:900px;height:1300px;background:#1f3a5f;
  box-shadow:0 20px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;align-items:center;
  justify-content:space-between;padding:110px 60px 120px;box-sizing:border-box;font-family:Georgia,'Times New Roman',serif;color:#f4e3b5;text-align:center;}
.title{font-size:120px;line-height:1.05;font-weight:700;letter-spacing:2px;}
.sun{width:300px;height:300px;border-radius:50%;background:#e8a23a;}
.author{font-size:92px;font-weight:700;letter-spacing:4px;}
</style></head><body><div class="cover">
<div class="title">THE COLOUR<br>OF MAGIC</div><div class="sun"></div><div class="author">TERRY<br>PRATCHETT</div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const jpeg = await page.screenshot({ type: 'jpeg', quality: 90 });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, jpeg);
  process.stdout.write(`${out}\n`);
} finally {
  await browser.close();
}
