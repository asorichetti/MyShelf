/**
 * @jest-environment node
 */
/* global afterEach, describe, it, expect, jest */

// Metro writes EXPO_PUBLIC_* values into release bundles while transforming,
// so its transform cache must be keyed on them (metro.config.js).
function cacheVersionWith(env) {
  const saved = { ...process.env };
  for (const name of Object.keys(process.env)) if (name.startsWith('EXPO_PUBLIC_')) delete process.env[name];
  Object.assign(process.env, env);
  try {
    let version;
    jest.isolateModules(() => {
      version = require('../metro.config.js').cacheVersion;
    });
    return version;
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
}

describe('metro.config.js transform cache key', () => {
  afterEach(() => jest.resetModules());

  it('differs between the E2E and the production build', () => {
    expect(cacheVersionWith({ EXPO_PUBLIC_E2E: '1' })).not.toBe(cacheVersionWith({ EXPO_PUBLIC_E2E: '0' }));
  });

  it('changes with any public value, such as the Google Books key, without writing it out', () => {
    const withKey = cacheVersionWith({ EXPO_PUBLIC_E2E: '0', EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY: 'secret-key' });
    expect(withKey).not.toBe(cacheVersionWith({ EXPO_PUBLIC_E2E: '0' }));
    expect(withKey).not.toContain('secret-key');
  });

  it('is the same for the same values, so a rebuild reuses its own cache', () => {
    expect(cacheVersionWith({ EXPO_PUBLIC_E2E: '1' })).toBe(cacheVersionWith({ EXPO_PUBLIC_E2E: '1' }));
  });
});
