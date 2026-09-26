import assert from 'node:assert/strict';
import { before, test } from 'node:test';

import { ExpectationError, all, expect, get, loadJourneys, q, register } from './registry.ts';
import { selectJourneys } from '../commands/journey.ts';

before(() => loadJourneys());

test('the registry is loaded, sorted by name and has a core suite', () => {
  const names = all().map((j) => j.name);
  assert.ok(names.length > 0, 'no journeys registered');
  assert.deepEqual(names, [...names].sort(), 'all() must be sorted by name');
  assert.ok(all().some((j) => j.suite === 'core'), 'smoke runs the core suite; it must not be empty');
  assert.ok(get('home-loads'));
});

test('registering a duplicate name throws', () => {
  assert.throws(() => register(all()[0]!), /duplicate journey name/);
});

test('registering an incomplete journey throws', () => {
  assert.throws(() => register({ name: 'x', suite: '', desc: 'd', run: async () => {} }), /incomplete journey/);
});

test('expect produces a readable message', () => {
  assert.doesNotThrow(() => expect(true, 'x'));
  assert.throws(
    () => expect(false, `/: expected h1 ${q('MyShelf')}, found ${q('MyShelff')}`),
    (err: unknown) => err instanceof ExpectationError && err.message === '/: expected h1 "MyShelf", found "MyShelff"',
  );
});

test('selectJourneys: --all --exclude-suite leaves that suite out and keeps every other', () => {
  const { selected, label } = selectJourneys([], { all: true, excludeSuite: ['core'] });
  assert.ok(selected.length > 0);
  assert.ok(selected.every((j) => j.suite !== 'core'));
  assert.deepEqual(
    selected.map((j) => j.name),
    all().filter((j) => j.suite !== 'core').map((j) => j.name),
  );
  assert.equal(label, 'all exclude-suite=core');
  assert.throws(() => selectJourneys([], { all: true, excludeSuite: [...new Set(all().map((j) => j.suite))] }), /no journeys match/);
});
