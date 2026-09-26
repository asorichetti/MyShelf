#!/usr/bin/env node
// Release notes for a GitHub Release (P09-07), printed as Markdown:
//
//   node scripts/release-notes.mjs <tag> [tag-message-file] [release-dir]
//
// The notes are the tag's section of CHANGELOG.md ("## [1.2.3]", "## 1.2.3"
// or "## v1.2.3", up to the next "## " heading) when there is one, otherwise
// the annotated tag's message, otherwise one line naming the version. After
// them comes a list of the files in release-dir and what each is for.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function changelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^##\\s+\\[?v?${escaped}\\]?(?=\\s|$)`);
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return body || null;
}

function describe(file) {
  const signed = file.includes('-debug-signed.') ? 'debug-signed' : 'signed';
  if (file.endsWith('.apk'))
    return signed === 'signed'
      ? `\`${file}\`: install on a phone (allow installs from this source when asked).`
      : `\`${file}\`: **debug-signed test build** for sideloading and testing only. It cannot be updated by, or update, a signed MyShelf.`;
  if (file.endsWith('.aab'))
    return signed === 'signed' ? `\`${file}\`: Android App Bundle for Google Play.` : `\`${file}\`: debug-signed App Bundle; Google Play will not accept it.`;
  if (file.endsWith('.sha256')) return `\`${file}\`: SHA-256 checksums (\`sha256sum -c ${file}\`).`;
  return `\`${file}\``;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [tag, tagMessageFile, releaseDir] = process.argv.slice(2);
  if (!tag) {
    process.stderr.write('usage: release-notes.mjs <tag> [tag-message-file] [release-dir]\n');
    process.exit(2);
  }
  const version = tag.replace(/^v/, '');
  const changelogPath = join(root, 'CHANGELOG.md');
  const fromChangelog = existsSync(changelogPath) ? changelogSection(readFileSync(changelogPath, 'utf8'), version) : null;
  const tagMessage = tagMessageFile && existsSync(tagMessageFile) ? readFileSync(tagMessageFile, 'utf8').trim() : '';
  const notes = fromChangelog ?? (tagMessage || `MyShelf ${version}.`);
  const files = releaseDir && existsSync(releaseDir) ? readdirSync(releaseDir).sort() : [];
  const downloads = files.length ? `\n\n### Downloads\n\n${files.map((f) => `- ${describe(f)}`).join('\n')}` : '';
  process.stdout.write(`${notes}${downloads}\n`);
}
