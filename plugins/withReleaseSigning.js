// Config plugin (P09-06): signs release builds with the upload keystore when
// one is supplied, and with the debug keystore otherwise, so that
// `./gradlew assembleRelease bundleRelease` always produces something
// installable. The keystore and its passwords never enter the repository:
// they are read at build time from Gradle properties (-P or
// ~/.gradle/gradle.properties) or environment variables of the same names:
//
//   MYSHELF_UPLOAD_STORE_FILE      path to the .jks / .keystore file
//   MYSHELF_UPLOAD_STORE_PASSWORD  keystore password
//   MYSHELF_UPLOAD_KEY_ALIAS       key alias
//   MYSHELF_UPLOAD_KEY_PASSWORD    key password
//
// See docs/release.md.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// MyShelf release signing (plugins/withReleaseSigning.js)';

const releaseSigningConfig = `
        ${MARKER}
        release {
            def uploadStoreFile = findProperty('MYSHELF_UPLOAD_STORE_FILE') ?: System.getenv('MYSHELF_UPLOAD_STORE_FILE')
            if (uploadStoreFile) {
                storeFile file(uploadStoreFile)
                storePassword findProperty('MYSHELF_UPLOAD_STORE_PASSWORD') ?: System.getenv('MYSHELF_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('MYSHELF_UPLOAD_KEY_ALIAS') ?: System.getenv('MYSHELF_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('MYSHELF_UPLOAD_KEY_PASSWORD') ?: System.getenv('MYSHELF_UPLOAD_KEY_PASSWORD')
            }
        }`;

const releaseSigningChoice = `signingConfig((findProperty('MYSHELF_UPLOAD_STORE_FILE') ?: System.getenv('MYSHELF_UPLOAD_STORE_FILE')) ? signingConfigs.release : signingConfigs.debug)`;

/** Adds the release signing config to android/app/build.gradle's text. Exported for tests. */
function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  const signingConfigs = /signingConfigs\s*\{/;
  const releaseUsesDebug = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!signingConfigs.test(gradle) || !releaseUsesDebug.test(gradle)) {
    throw new Error(
      'withReleaseSigning: android/app/build.gradle no longer has the expected signingConfigs / release blocks. ' +
        'Update plugins/withReleaseSigning.js for this Expo SDK.',
    );
  }
  return gradle
    .replace(signingConfigs, (match) => `${match}${releaseSigningConfig}`)
    .replace(releaseUsesDebug, (_match, before) => `${before}${releaseSigningChoice}`);
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: expected a Groovy android/app/build.gradle');
    }
    mod.modResults.contents = addReleaseSigning(mod.modResults.contents);
    return mod;
  });

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
