#!/usr/bin/env node
// Records Open Library / Google Books responses as fixtures for the auto test
// suite's API mocking (--mock-api, P02-13) and adds them to the fixture index.
//
//   node scripts/record-fixture.mjs <url> [<url> ...] [--name <file>] [--expected] [--dir <fixtures>] [--dry-run]
//
// Run it by hand, never in CI. It follows the API etiquette (PLAN.md §6): it
// identifies itself with the app's User-Agent, sends one request at a time at
// most once a second, and follows redirects (Open Library's /isbn/ URLs
// redirect to /books/). Nothing personal is sent, so nothing is stripped; a
// Google Books API key is never used, so none can end up in a fixture.
//
// The body is written pretty-printed to <dir>/<openlibrary|googlebooks|covers>/<name>
// (default name: derived from the URL) and an entry { url, status?, body,
// expected? } is added to <dir>/index.json, replacing an entry for the same
// URL. A response with status >= 400 is recorded only with --expected (a
// deliberate error fixture, such as the 404 for an unknown ISBN).
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
const USER_AGENT = `MyShelf/${pkg.expo.version} (+https://github.com/asorichetti/MyShelf)`;
const HOSTS = { 'openlibrary.org': 'openlibrary', 'www.googleapis.com': 'googlebooks', 'covers.openlibrary.org': 'covers' };

function usage(message) {
  if (message) process.stderr.write(`record-fixture: ${message}\n`);
  process.stderr.write('usage: node scripts/record-fixture.mjs <url> [<url> ...] [--name <file>] [--expected] [--dir <fixtures>] [--dry-run]\n');
  process.exit(2);
}

const args = process.argv.slice(2);
const urls = [];
let name = null;
let expected = false;
let dryRun = false;
let dir = join(root, 'src/services/metadata/__fixtures__');
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--name') name = args[++i] ?? usage('--name needs a value');
  else if (a === '--dir') dir = resolve(args[++i] ?? usage('--dir needs a value'));
  else if (a === '--expected') expected = true;
  else if (a === '--dry-run') dryRun = true;
  else if (a === '--help' || a === '-h') usage();
  else if (a.startsWith('--')) usage(`unknown flag ${a}`);
  else urls.push(a);
}
if (!urls.length) usage('no URL given');
if (name && urls.length > 1) usage('--name works with one URL only');

/**
 * A readable file name in the existing style: /books/OL…M -> edition-OL…M.json
 * (an /isbn/ URL is named after the edition it redirects to), /works/ ->
 * work-, /authors/ -> author-, a search -> search-<words>.json.
 */
function fileNameFor(url, finalUrl) {
  const u = new URL(finalUrl || url);
  const kinds = { books: 'edition', works: 'work', authors: 'author', isbn: 'isbn' };
  const parts = u.pathname.replace(/^\/books\/v1\//, '').replace(/\.(json|jpe?g|png)$/i, '').split('/').filter(Boolean);
  const ext = /\.(jpe?g|png)$/i.exec(u.pathname)?.[0] ?? '.json';
  if (parts.length === 2 && kinds[parts[0]]) return `${kinds[parts[0]]}-${parts[1]}${ext}`;
  const q = u.searchParams.get('q') ?? [u.searchParams.get('title'), u.searchParams.get('author')].filter(Boolean).join(' ');
  const words = q ? `-${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
  return `${parts.join('-')}${words}`.slice(0, 120) + ext;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const indexPath = join(dir, 'index.json');
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { routes: [] };

let last = 0;
for (const url of urls) {
  const host = new URL(url).host;
  const sub = HOSTS[host];
  if (!sub) usage(`${host} is not a mocked host (${Object.keys(HOSTS).join(', ')})`);
  if (/[?&]key=/.test(url)) usage('refusing to record a URL carrying an API key');
  const wait = last + 1000 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, redirect: 'follow' });
  const type = res.headers.get('content-type') ?? '';
  const bytes = Buffer.from(await res.arrayBuffer());
  process.stderr.write(`record-fixture: GET ${url} -> ${res.status} ${type} (${bytes.length} bytes)${res.redirected ? ` via ${res.url}` : ''}\n`);
  if (res.status >= 400 && !expected) {
    process.stderr.write('record-fixture: not recorded; pass --expected to keep a deliberate error response\n');
    process.exitCode = 1;
    continue;
  }
  let file = name ?? fileNameFor(url, res.redirected ? res.url : null);
  let body = bytes;
  if (type.includes('json')) body = Buffer.from(JSON.stringify(JSON.parse(bytes.toString('utf8')), null, 2) + '\n');
  else if (type.includes('html') && file.endsWith('.json')) file = file.replace(/\.json$/, '.html');
  const rel = `${sub}/${file}`;
  const entry = { url, ...(res.status !== 200 ? { status: res.status } : {}), body: rel, ...(expected ? { expected: true } : {}) };
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
    continue;
  }
  mkdirSync(join(dir, sub), { recursive: true });
  writeFileSync(join(dir, rel), body);
  index.routes = [...index.routes.filter((r) => r.url !== url), entry];
  process.stderr.write(`record-fixture: wrote ${relative(root, join(dir, rel))}\n`);
}
if (!dryRun) writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
