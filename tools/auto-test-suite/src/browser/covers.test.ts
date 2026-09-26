import assert from 'node:assert/strict';
import { test } from 'node:test';

import { coverResponse, PADDED_COVER_IDS } from './covers.ts';
import { ExpectedMissingMarker } from '../uxgates/expected.ts';

const JPEG = [0xff, 0xd8, 0xff];

test('covers are answered with the synthetic JPEG', () => {
  const r = coverResponse('https://covers.openlibrary.org/b/id/14647238-L.jpg');
  assert.equal(r.status, 200);
  assert.equal(r.contentType, 'image/jpeg');
  assert.deepEqual([...(r.body as Buffer).subarray(0, 3)], JPEG);
});

test('the padded ids get the square scan, other covers the 2:3 one', () => {
  const padded = coverResponse(`https://covers.openlibrary.org/b/id/${PADDED_COVER_IDS[0]}-L.jpg`).body as Buffer;
  const plain = coverResponse('https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg?default=false').body as Buffer;
  assert.notDeepEqual(padded, plain);
});

test('a missing cover gets what Open Library really sends: a 1x1 GIF, or a 404 with default=false', () => {
  const gif = coverResponse(`https://covers.openlibrary.org/b/id/${ExpectedMissingMarker}-L.jpg`);
  assert.equal(gif.status, 200);
  assert.equal(gif.contentType, 'image/gif');
  const body = gif.body as Buffer;
  assert.equal(body.subarray(0, 6).toString('latin1'), 'GIF89a');
  assert.deepEqual([body.readUInt16LE(6), body.readUInt16LE(8)], [1, 1]);
  const missing = coverResponse(`https://covers.openlibrary.org/b/id/${ExpectedMissingMarker}-L.jpg?default=false`);
  assert.equal(missing.status, 404);
});
