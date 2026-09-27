// Config plugin: shrinks release builds with R8 (code and resources).
//
// Without it the release APK carries every class of every library, about
// 54 MB of dex for arm64-v8a, which Android also compiles ahead of time on
// install: the arm64-v8a APK was 72 MB to download and 122 MB installed.
// With R8 it is 61 MB and 78 MB. The generated build.gradle reads these two
// Gradle properties; libraries ship their own keep rules, and the Maestro
// suite runs on the shrunk build (docs/device-testing.md), so a class R8
// wrongly removed shows up there.
const { withGradleProperties } = require('expo/config-plugins');

const PROPERTIES = {
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

/** Sets the properties in gradle.properties' parsed lines, replacing any earlier values. Exported for tests. */
function setShrinkingProperties(lines) {
  const out = lines.filter((l) => !(l.type === 'property' && l.key in PROPERTIES));
  for (const [key, value] of Object.entries(PROPERTIES)) out.push({ type: 'property', key, value });
  return out;
}

const withReleaseShrinking = (config) =>
  withGradleProperties(config, (mod) => {
    mod.modResults = setShrinkingProperties(mod.modResults);
    return mod;
  });

module.exports = withReleaseShrinking;
module.exports.setShrinkingProperties = setShrinkingProperties;
