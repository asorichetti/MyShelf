// A small static file server for an exported web build (`npx expo export
// --platform web`, i.e. `dist/`), used by the global --serve flag and by the
// gate self-tests. It behaves like a production host rather than the Expo dev
// server: unknown routes fall back to index.html (SPA routing with
// web.output "single"), but a missing asset is a real 404. Every response is
// cross-origin isolated (the same COOP/COEP values metro.config.js sends), so
// expo-sqlite's WebAssembly build gets SharedArrayBuffer.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

import { errorMessage } from '../errors.ts';

/** Sent on every response, as metro.config.js does for the dev server. */
export const IsolationHeaders: Readonly<Record<string, string>> = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

// Content types for what an Expo web export contains (plus the self-test
// fixtures). .wasm must be application/wasm or WebAssembly.instantiateStreaming
// refuses it.
const MimeTypes: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

/** The content type for a file name; unknown extensions are served as bytes. */
export function contentType(file: string): string {
  return MimeTypes[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

export interface StaticServer {
  /** http://127.0.0.1:<port>, without a trailing slash. */
  url: string;
  port: number;
  close(): Promise<void>;
}

export interface StaticServerOptions {
  /** 0 (the default) picks a free port. */
  port?: number;
  host?: string;
  /** The SPA shell served for extension-less unknown paths. Default index.html. */
  fallback?: string;
}

/** What a request path maps to. Exported for tests. */
export type Resolution =
  | { kind: 'file'; path: string }
  | { kind: 'fallback'; path: string }
  | { kind: 'forbidden'; reason: string }
  | { kind: 'missing' };

async function isFile(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

// resolveRequest maps a URL path onto root. Paths are percent-decoded before
// the containment check, so %2e%2e cannot climb out either.
export async function resolveRequest(root: string, rawPath: string, fallback = 'index.html'): Promise<Resolution> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(rawPath, 'http://x').pathname);
  } catch {
    return { kind: 'forbidden', reason: 'malformed path' };
  }
  if (pathname.includes('\0')) return { kind: 'forbidden', reason: 'NUL in path' };
  // new URL() already collapses plain ../ segments; a decoded %2e%2e or a
  // backslash survives it, so check the resolved path as well.
  if (pathname.split(/[\\/]/).includes('..')) return { kind: 'forbidden', reason: 'path traversal' };
  const abs = resolve(root, '.' + pathname);
  if (abs !== root && !abs.startsWith(root + sep)) return { kind: 'forbidden', reason: 'path traversal' };

  if (await isFile(abs)) return { kind: 'file', path: abs };
  const index = join(abs, 'index.html');
  if (await isFile(index)) return { kind: 'file', path: index };
  // A route (no extension in the last segment) gets the SPA shell; anything
  // that looks like a file is really missing.
  const last = pathname.split('/').pop() ?? '';
  if (extname(last) === '') return { kind: 'fallback', path: join(root, fallback) };
  return { kind: 'missing' };
}

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { ...IsolationHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function handle(root: string, fallback: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    send(res, 405, 'method not allowed\n');
    return;
  }
  const r = await resolveRequest(root, req.url ?? '/', fallback);
  if (r.kind === 'forbidden') return send(res, 403, `forbidden: ${r.reason}\n`);
  if (r.kind === 'missing') return send(res, 404, 'not found\n');
  let size: number;
  try {
    size = (await stat(r.path)).size;
  } catch {
    return send(res, 404, 'not found\n');
  }
  res.writeHead(200, {
    ...IsolationHeaders,
    'Content-Type': contentType(r.path),
    'Content-Length': String(size),
    // Test runs must never see a stale bundle from an earlier export.
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(r.path);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

// startStaticServer serves dir on 127.0.0.1 (a free port unless one is
// given). It fails before listening when dir has no fallback page, because a
// server that answers every route with 404 only produces confusing gate
// failures.
export async function startStaticServer(dir: string, opts: StaticServerOptions = {}): Promise<StaticServer> {
  const root = resolve(dir);
  const fallback = opts.fallback ?? 'index.html';
  let st;
  try {
    st = await stat(root);
  } catch (err) {
    throw new Error(`--serve ${dir}: ${errorMessage(err)}`);
  }
  if (!st.isDirectory()) throw new Error(`--serve ${dir}: not a directory`);
  if (!(await isFile(join(root, fallback)))) {
    throw new Error(`--serve ${dir}: no ${fallback} (export the web build first: npm run export:web)`);
  }
  const host = opts.host ?? '127.0.0.1';
  const server: Server = createServer((req, res) => {
    handle(root, fallback, req, res).catch((err) => {
      if (!res.headersSent) send(res, 500, `internal error: ${errorMessage(err)}\n`);
      else res.destroy();
    });
  });
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(opts.port ?? 0, host, () => {
      server.off('error', fail);
      ok();
    });
  });
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    server.close();
    throw new Error('static server: no TCP address');
  }
  return {
    url: `http://${host}:${addr.port}`,
    port: addr.port,
    close: () =>
      new Promise<void>((ok) => {
        // Chromium keeps connections alive; do not wait for it to let go.
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}
