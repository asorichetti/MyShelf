import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

import { IsolationHeaders, contentType, resolveRequest, startStaticServer, type StaticServer } from './static.ts';

// A miniature export: the SPA shell, a bundle, a wasm file and a secret one
// level above the served root.
const parent = mkdtempSync(join(tmpdir(), 'autotest-serve-'));
const root = join(parent, 'dist');
mkdirSync(join(root, '_expo', 'static'), { recursive: true });
mkdirSync(join(root, 'nested'), { recursive: true });
writeFileSync(join(root, 'index.html'), '<!doctype html><title>shell</title>');
writeFileSync(join(root, '_expo', 'static', 'entry.js'), 'console.log(1)');
writeFileSync(join(root, 'sqlite.wasm'), Buffer.from([0, 97, 115, 109]));
writeFileSync(join(root, 'nested', 'index.html'), 'nested');
writeFileSync(join(parent, 'secret.txt'), 'do not serve');

interface Got {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

// fetch() normalises ../ away before sending, so traversal needs a raw request.
function get(srv: StaticServer, path: string, method = 'GET'): Promise<Got> {
  return new Promise((ok, fail) => {
    const req = request({ host: '127.0.0.1', port: srv.port, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => ok({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

describe('static server', () => {
  let srv: StaticServer;
  before(async () => {
    srv = await startStaticServer(root);
  });
  after(() => srv.close());

  test('listens on an ephemeral loopback port', () => {
    assert.match(srv.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.ok(srv.port > 0);
  });

  test('serves files with their content type', async () => {
    const js = await get(srv, '/_expo/static/entry.js');
    assert.equal(js.status, 200);
    assert.equal(js.body, 'console.log(1)');
    assert.match(String(js.headers['content-type']), /^text\/javascript/);
    const wasm = await get(srv, '/sqlite.wasm');
    assert.equal(wasm.status, 200);
    assert.equal(wasm.headers['content-type'], 'application/wasm');
  });

  test('routes without an extension fall back to index.html', async () => {
    for (const p of ['/', '/scan', '/books/42', '/missing-shelf__expected-404?x=1']) {
      const r = await get(srv, p);
      assert.equal(r.status, 200, p);
      assert.equal(r.body, '<!doctype html><title>shell</title>', p);
      assert.match(String(r.headers['content-type']), /^text\/html/, p);
    }
  });

  test('a directory with an index.html serves it', async () => {
    assert.equal((await get(srv, '/nested')).body, 'nested');
  });

  test('a missing asset is a real 404, not the shell', async () => {
    for (const p of ['/assets/missing.png', '/_expo/static/nope.js', '/sqlite2.wasm']) {
      const r = await get(srv, p);
      assert.equal(r.status, 404, p);
      assert.doesNotMatch(r.body, /shell/, p);
    }
  });

  test('every response is cross-origin isolated', async () => {
    for (const p of ['/', '/scan', '/sqlite.wasm', '/missing.png']) {
      const r = await get(srv, p);
      for (const [k, v] of Object.entries(IsolationHeaders)) assert.equal(r.headers[k.toLowerCase()], v, `${p} ${k}`);
    }
  });

  test('path traversal is rejected', async () => {
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/nested/%2e%2e/%2e%2e/secret.txt', '/..%2fsecret.txt', '/..%5csecret.txt']) {
      const r = await get(srv, p);
      assert.ok(r.status === 403 || r.status === 404, `${p}: status ${r.status}`);
      assert.doesNotMatch(r.body, /do not serve/, p);
    }
  });

  test('HEAD has headers and no body; other methods are refused', async () => {
    const head = await get(srv, '/_expo/static/entry.js', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-length'], '14');
    assert.equal(head.body, '');
    const post = await get(srv, '/', 'POST');
    assert.equal(post.status, 405);
  });
});

describe('resolveRequest', () => {
  test('encoded traversal never leaves the root', async () => {
    // The URL parser already folds /%2e%2e/ away; an encoded slash survives it.
    assert.deepEqual(await resolveRequest(root, '/%2e%2e/secret.txt'), { kind: 'missing' });
    assert.deepEqual(await resolveRequest(root, '/..%2fsecret.txt'), { kind: 'forbidden', reason: 'path traversal' });
    assert.deepEqual(await resolveRequest(root, '/..%5csecret.txt'), { kind: 'forbidden', reason: 'path traversal' });
    assert.deepEqual(await resolveRequest(root, '/a%00b'), { kind: 'forbidden', reason: 'NUL in path' });
    assert.deepEqual(await resolveRequest(root, '/%E0%A4%A'), { kind: 'forbidden', reason: 'malformed path' });
  });
});

describe('startStaticServer', () => {
  test('refuses a directory without index.html', async () => {
    await assert.rejects(startStaticServer(join(root, '_expo')), /no index\.html \(export the web build first/);
  });
  test('refuses a missing directory', async () => {
    await assert.rejects(startStaticServer(join(parent, 'nope')), /--serve .*nope/);
  });
});

test('contentType covers the export', () => {
  assert.equal(contentType('a.WASM'), 'application/wasm');
  assert.equal(contentType('f.ttf'), 'font/ttf');
  assert.equal(contentType('x.unknown'), 'application/octet-stream');
});
