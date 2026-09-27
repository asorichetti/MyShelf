// Config plugin: one release APK per ABI when asked for, so a phone
// downloads only its own native code (docs/release.md).
//
// The universal APK carries the native libraries for all four ABIs React
// Native builds (about 147 MB installed); an arm64-v8a APK, which every
// current phone runs, is well under half that. Splits apply to APKs only:
// the App Bundle stays universal and Google Play splits it per device.
//
// Off unless the Gradle property `myshelfApkAbis` lists the ABIs, so local
// builds still write the single android/app/build/outputs/apk/release/app-release.apk:
//
//   ./gradlew assembleRelease -PmyshelfApkAbis=arm64-v8a,armeabi-v7a
//     -> app-arm64-v8a-release.apk, app-armeabi-v7a-release.apk
//
// Build the App Bundle in a separate Gradle run: with resource shrinking on
// (withReleaseShrinking.js) the Android Gradle plugin refuses per-ABI APKs
// and a bundle together (https://issuetracker.google.com/402800800).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// MyShelf per-ABI APKs (plugins/withApkAbiSplits.js)';

const splits = `
    ${MARKER}
    splits {
        abi {
            def apkAbis = findProperty('myshelfApkAbis')
            enable apkAbis != null
            if (apkAbis) {
                reset()
                include(*apkAbis.toString().split(',').collect { it.trim() })
                universalApk false
            }
        }
    }
`;

/** Adds the splits block to android/app/build.gradle's text. Exported for tests. */
function addAbiSplits(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  const androidBlock = /^android\s*\{\n/m;
  if (!androidBlock.test(gradle)) {
    throw new Error('withApkAbiSplits: android/app/build.gradle has no top-level android { } block. Update plugins/withApkAbiSplits.js for this Expo SDK.');
  }
  if (/^\s*splits\s*\{/m.test(gradle)) {
    throw new Error('withApkAbiSplits: android/app/build.gradle already has a splits block. Merge it with plugins/withApkAbiSplits.js.');
  }
  return gradle.replace(androidBlock, (match) => `${match}${splits}`);
}

const withApkAbiSplits = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withApkAbiSplits: expected a Groovy android/app/build.gradle');
    }
    mod.modResults.contents = addAbiSplits(mod.modResults.contents);
    return mod;
  });

module.exports = withApkAbiSplits;
module.exports.addAbiSplits = addAbiSplits;
