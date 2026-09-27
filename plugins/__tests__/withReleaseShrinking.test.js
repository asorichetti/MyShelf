/**
 * @jest-environment node
 */
/* global it, expect */
const { setShrinkingProperties } = require('../withReleaseShrinking');

it('turns on R8 code and resource shrinking, replacing earlier values', () => {
  const lines = [
    { type: 'comment', value: 'generated' },
    { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
    { type: 'property', key: 'hermesEnabled', value: 'true' },
  ];
  const out = setShrinkingProperties(lines);
  const props = Object.fromEntries(out.filter((l) => l.type === 'property').map((l) => [l.key, l.value]));
  expect(props).toEqual({
    hermesEnabled: 'true',
    'android.enableMinifyInReleaseBuilds': 'true',
    'android.enableShrinkResourcesInReleaseBuilds': 'true',
  });
  expect(out.filter((l) => l.key === 'android.enableMinifyInReleaseBuilds')).toHaveLength(1);
  expect(setShrinkingProperties(out)).toEqual(out);
});
