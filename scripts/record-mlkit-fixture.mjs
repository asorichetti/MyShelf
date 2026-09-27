#!/usr/bin/env node
// Records what ML Kit read on an Android device or emulator as an OCR fixture
// for src/domain/ocrQuery.ts (P03-06). Run by hand, never in CI:
//
//   1. Install an E2E build (EXPO_PUBLIC_E2E=1): it logs each cover it reads.
//   2. Put the photo on the device (adb push it to /sdcard/Pictures, then
//      `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/<file>`).
//   3. In the app: Scan → Cover → Choose from your photos → the photo.
//   4. node scripts/record-mlkit-fixture.mjs --name real-mlkit-dune \
//        --title "Dune" --author "Frank Herbert" --description "Handheld photo, …" \
//        [--device emulator-5556] [--ocr-title "dune"] [--image-size 3024x4032] [--source "…"]
//
// It takes the latest `[myshelf-ocr n/total]` pieces from logcat, joins them
// and writes src/domain/__fixtures__/ocr/<name>.json. Only the recognised text
// and its frames are written: never commit the photo (the cover art is not ours).
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    title: { type: 'string' },
    author: { type: 'string' },
    'ocr-title': { type: 'string' },
    description: { type: 'string', default: '' },
    device: { type: 'string' },
    'image-size': { type: 'string' },
    source: { type: 'string', default: 'ML Kit on Android emulator from developer photos' },
  },
});
if (!values.name || !values.title) {
  console.error('usage: node scripts/record-mlkit-fixture.mjs --name <fixture> --title <title> [--author <author>] [--description <text>] [--device <serial>]');
  process.exit(2);
}

const adb = ['logcat', '-d', '-v', 'raw', '-s', 'ReactNativeJS:I'];
const log = execFileSync('adb', values.device ? ['-s', values.device, ...adb] : adb, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** The pieces of the last complete result in the log. */
function lastResult(text) {
  const piece = /\[myshelf-ocr (\d+)\/(\d+)\] (.*)$/;
  let current = null;
  let complete = null;
  for (const line of text.split('\n')) {
    const m = piece.exec(line);
    if (!m) continue;
    const [n, total, body] = [Number(m[1]), Number(m[2]), m[3]];
    if (n === 1) current = [];
    if (!current || current.length !== n - 1) {
      current = null;
      continue;
    }
    current.push(body);
    if (n === total) complete = current.join('');
  }
  return complete;
}

const json = lastResult(log);
if (!json) {
  console.error('No complete [myshelf-ocr] result in the log: read a cover in an E2E build first.');
  process.exit(1);
}
const result = JSON.parse(json);
const [width, height] = (values['image-size'] ?? '').split('x').map(Number);
const fixture = {
  synthetic: false,
  recogniser: 'mlkit',
  source: values.source,
  note: "ML Kit Text Recognition v2 (bundled Latin model) through the app's module, read from the phone photo chosen in Scan → Cover (scripts/record-mlkit-fixture.mjs). The photo is not committed (the cover art is copyrighted).",
  description: values.description,
  expected: { title: values.title, author: values.author ?? null, ...(values['ocr-title'] ? { ocrTitle: values['ocr-title'] } : {}) },
  ...(width && height ? { imageSize: { width, height } } : {}),
  result,
};
const path = join('src', 'domain', '__fixtures__', 'ocr', `${values.name}.json`);
writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
const lines = result.blocks.flatMap((b) => b.lines.map((l) => `${String(l.frame.height).padStart(5)}  ${l.text}`));
console.log(`wrote ${path}: ${result.blocks.length} blocks\n${lines.join('\n')}`);
