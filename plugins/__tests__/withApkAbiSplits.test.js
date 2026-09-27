/**
 * @jest-environment node
 */
/* global it, expect */
const { addAbiSplits } = require('../withApkAbiSplits');

// The start of android/app/build.gradle that `expo prebuild` writes for SDK 57.
const generated = `apply plugin: "com.android.application"

android {
    ndkVersion rootProject.ext.ndkVersion
    defaultConfig {
        versionCode 1
    }
}
`;

it('adds APK splits driven by the myshelfApkAbis property, once', () => {
  const out = addAbiSplits(generated);
  expect(out).toContain("def apkAbis = findProperty('myshelfApkAbis')");
  expect(out).toContain('enable apkAbis != null');
  expect(out).toContain('universalApk false');
  // Inside the android block, before what was there.
  expect(out.indexOf('splits {')).toBeGreaterThan(out.indexOf('android {'));
  expect(out.indexOf('splits {')).toBeLessThan(out.indexOf('ndkVersion'));
  expect(addAbiSplits(out)).toBe(out);
});

it('refuses a build.gradle it does not recognise', () => {
  expect(() => addAbiSplits('apply plugin: "x"\n')).toThrow(/no top-level android/);
  expect(() => addAbiSplits('android {\n    splits {\n    }\n}\n')).toThrow(/already has a splits block/);
});
