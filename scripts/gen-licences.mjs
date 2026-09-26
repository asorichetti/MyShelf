#!/usr/bin/env node
// Lists the licence of every production package in package-lock.json (every
// package npm installs that is not only a development tool) into
// src/generated/licences.json, for the About screen (P08-08).
// Run with --check to fail (exit 1) when the committed file is out of date,
// e.g. after adding a dependency without regenerating.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const out = join(root, 'src/generated/licences.json');

const seen = new Map();
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith('node_modules/') || entry.dev || entry.devOptional || entry.link) continue;
  const name = entry.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const license = typeof entry.license === 'string' ? entry.license : 'See the package';
  const key = `${name}@${entry.version}`;
  if (!seen.has(key)) seen.set(key, { name, version: entry.version, license });
}
const packages = [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : 1));
const text = `${JSON.stringify({ generatedBy: 'scripts/gen-licences.mjs', packages }, null, 1)}\n`;

if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== text) {
    process.stderr.write('licences: src/generated/licences.json is out of date. Run `npm run licences:gen` and commit the result.\n');
    process.exit(1);
  }
  process.stdout.write(`licences: up to date (${packages.length} packages)\n`);
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  process.stdout.write(`licences: wrote ${packages.length} packages to src/generated/licences.json\n`);
}
