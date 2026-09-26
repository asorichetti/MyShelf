#!/usr/bin/env node
// The version name and Android versionCode for a release (P09-06).
//
//   node scripts/release-version.mjs v1.2.3          version=1.2.3, versionCode=1020399
//   node scripts/release-version.mjs v1.2.3-rc4      version=1.2.3-rc4, versionCode=1020304
//   node scripts/release-version.mjs                 the values in app.json
//   node scripts/release-version.mjs v1.2.3 --write  also writes them into app.json
//
// The tag is the version. versionCode = major * 1000000 + minor * 10000 +
// patch * 100 + (release candidate number, or 99 for the release itself), so
// it grows with every tag, a release candidate sorts below its release, and
// any build of a given tag gets the same code whether it is built on CI, with
// EAS or locally. Prints `key=value` lines, ready for $GITHUB_OUTPUT.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'app.json');

export function versionFromTag(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-rc\.?(\d+))?$/.exec(tag.trim());
  if (!m) throw new Error(`"${tag}" is not a release tag: use vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-rcN`);
  const [major, minor, patch] = [m[1], m[2], m[3]].map(Number);
  const rc = m[4] === undefined ? null : Number(m[4]);
  if (minor > 99 || patch > 99) throw new Error(`${tag}: minor and patch must be 0-99 to fit the versionCode scheme`);
  if (major > 2099) throw new Error(`${tag}: major must be at most 2099 (Android's versionCode limit)`);
  if (rc !== null && (rc < 1 || rc > 98)) throw new Error(`${tag}: release candidates are numbered 1-98`);
  const version = `${major}.${minor}.${patch}${rc === null ? '' : `-rc${rc}`}`;
  const versionCode = major * 1_000_000 + minor * 10_000 + patch * 100 + (rc ?? 99);
  return { version, versionCode };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const tag = args.find((a) => !a.startsWith('--'));
  const app = JSON.parse(readFileSync(appJsonPath, 'utf8'));
  let result;
  try {
    result = tag ? versionFromTag(tag) : { version: app.expo.version, versionCode: app.expo.android.versionCode };
  } catch (e) {
    process.stderr.write(`release-version: ${e.message}\n`);
    process.exit(1);
  }
  if (tag && args.includes('--write')) {
    app.expo.version = result.version;
    app.expo.android.versionCode = result.versionCode;
    writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);
  }
  process.stdout.write(`version=${result.version}\nversionCode=${result.versionCode}\n`);
}
