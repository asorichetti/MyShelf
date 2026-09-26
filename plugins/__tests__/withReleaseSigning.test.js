/**
 * @jest-environment node
 */
/* global it, expect */
const { addReleaseSigning } = require('../withReleaseSigning');

// The shape of android/app/build.gradle that `expo prebuild` writes for SDK 57.
const generated = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            shrinkResources enableShrinkResources.toBoolean()
        }
    }
}
`;

it('adds a release signing config read from properties or the environment', () => {
  const out = addReleaseSigning(generated);
  expect(out).toContain("def uploadStoreFile = findProperty('MYSHELF_UPLOAD_STORE_FILE') ?: System.getenv('MYSHELF_UPLOAD_STORE_FILE')");
  expect(out).toMatch(/signingConfigs \{\n\s+\/\/ MyShelf release signing[\s\S]*release \{[\s\S]*\}\n\s+debug \{/);
});

it('signs release builds with the upload key when given, else the debug key', () => {
  const out = addReleaseSigning(generated);
  const [, debugType, releaseType] = /debug \{\n\s+(signingConfig[^\n]*)[\s\S]*release \{\n\s+(signingConfig[^\n]*)\n\s+shrink/.exec(out) ?? [];
  expect(debugType).toBe('signingConfig signingConfigs.debug');
  expect(releaseType).toBe(
    "signingConfig((findProperty('MYSHELF_UPLOAD_STORE_FILE') ?: System.getenv('MYSHELF_UPLOAD_STORE_FILE')) ? signingConfigs.release : signingConfigs.debug)",
  );
});

it('is idempotent', () => {
  const once = addReleaseSigning(generated);
  expect(addReleaseSigning(once)).toBe(once);
});

it('fails loudly when the generated file changes shape', () => {
  expect(() => addReleaseSigning('android {}')).toThrow(/expected signingConfigs/);
});
