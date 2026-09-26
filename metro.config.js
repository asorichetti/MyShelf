// Learn more https://docs.expo.dev/guides/customizing-metro
const { ServerResponse } = require('node:http');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite as WebAssembly.
config.resolver.assetExts.push('wasm');

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
