// The render and a11y audits run inside the page, where only their own
// serialized source exists. The TypeScript loader wraps named inner functions
// in a __name(fn, "name") helper; Browser.newPage installs EVALUATE_SHIM in
// every page so that helper resolves. These checks keep the two in step. The
// audits' behaviour is proven against the real app and a deliberately broken
// page (see README, "Proving the gates fire").
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';

import { a11yAudit } from './a11y.ts';
import { renderAudit } from './render.ts';
import { EVALUATE_SHIM } from '../browser/browser.ts';

test('the evaluate shim makes __name the identity function', () => {
  const ctx = vm.createContext({});
  vm.runInContext(EVALUATE_SHIM, ctx);
  const f = () => 1;
  assert.equal((ctx as { __name: (fn: unknown, n: string) => unknown }).__name(f, 'f'), f);
});

for (const [name, fn] of Object.entries({ a11yAudit, renderAudit })) {
  test(`${name} serializes to source that compiles on its own`, () => {
    const src = fn.toString();
    const ctx = vm.createContext({});
    vm.runInContext(EVALUATE_SHIM, ctx);
    assert.equal(typeof vm.runInContext(`(${src})`, ctx), 'function');
  });
}
