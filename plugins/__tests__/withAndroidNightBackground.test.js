/**
 * @jest-environment node
 */
/* global it, expect */
const { expo } = require('../../app.json');
const { lightColors, darkColors } = require('../../src/theme/tokens');
const { setBackgroundColor } = require('../withAndroidNightBackground');

it('writes the colour value, replacing an earlier one', () => {
  const colors = setBackgroundColor({ resources: { color: [{ $: { name: 'colorAccent' }, _: '#C4A8EE' }] } }, '#000000');
  expect(setBackgroundColor(colors, '#1C1424').resources.color).toEqual([
    { $: { name: 'colorAccent' }, _: '#C4A8EE' },
    { $: { name: 'activityBackground' }, _: '#1C1424' },
  ]);
});

it('uses the theme papers: light in app.json, night in values-night', () => {
  expect(expo.backgroundColor).toBe(lightColors.paper);
  const entry = expo.plugins.find((p) => Array.isArray(p) && p[0] === './plugins/withAndroidNightBackground');
  expect(entry[1]).toEqual({ dark: darkColors.paper });
});

it('gives the splash screen the same papers', () => {
  const splash = expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
  expect(splash.backgroundColor).toBe(lightColors.paper);
  expect(splash.dark).toEqual({ image: './assets/splash-icon-dark.png', backgroundColor: darkColors.paper });
});
