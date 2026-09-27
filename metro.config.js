// Learn more https://docs.expo.dev/guides/customizing-metro
const { createHash } = require('node:crypto');
const { ServerResponse } = require('node:http');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite as WebAssembly.
config.resolver.assetExts.push('wasm');

// A release bundle has each EXPO_PUBLIC_* value written into the code as it is
// transformed, but Metro's transform cache is not keyed on those values. React
// Native's build resets the cache every time, except that Expo skips the reset
// when CI is set: on GitHub Actions the production APK, built after the E2E
// one, reused the E2E build's modules and came out with the fixture loader on
// (and the other way round). Keying the cache on the values keeps each build's
// own; they are hashed so no value is written anywhere.
const publicEnv = Object.keys(process.env)
  .filter((name) => name.startsWith('EXPO_PUBLIC_'))
  .sort()
  .map((name) => `${name}=${process.env[name]}`)
  .join('\n');
config.cacheVersion = `${config.cacheVersion ?? ''}+env-${createHash('sha256').update(publicEnv).digest('hex').slice(0, 16)}`;

// The recorded API responses (src/generated/e2eApiFixtures.json, read by
// src/features/e2e/mockApi.ts) go only into the Android E2E build, made with
// EXPO_PUBLIC_E2E_MOCK_API=1. Every other build resolves the file to an empty
// module, so neither the fixtures nor their size reach a user's phone.
const E2E_API_FIXTURES = /(^|[\\/])generated[\\/]e2eApiFixtures\.json$/;
if (process.env.EXPO_PUBLIC_E2E_MOCK_API !== '1') {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (E2E_API_FIXTURES.test(moduleName)) return { type: 'empty' };
    return (upstream ?? context.resolveRequest)(context, moduleName, platform);
  };
}

// expo-sqlite on web needs SharedArrayBuffer, which browsers only enable on
// cross-origin isolated pages: the HTML document itself must be served with
// COOP/COEP. The documented `server.enhanceMiddleware` hook only wraps Metro's
// own handler, which runs *after* the Expo CLI has already served index.html
// (web.output "single"), so the page would not be isolated. Instead, add the
// headers to every response this dev-server process writes. This file is only
// loaded by the Expo CLI (start/export), so nothing else is affected.
// Production hosting needs the same headers (see the expo-router plugin
// `headers` in app.json for EAS Hosting / expo-server).
const ISOLATION_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
if (!ServerResponse.prototype.__myshelfIsolation) {
  const writeHead = ServerResponse.prototype.writeHead;
  ServerResponse.prototype.writeHead = function writeHeadWithIsolation(...args) {
    for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
      if (!this.headersSent && !this.hasHeader(name)) this.setHeader(name, value);
    }
    return writeHead.apply(this, args);
  };
  ServerResponse.prototype.__myshelfIsolation = true;
}

module.exports = config;
