/**
 * @jest-environment node
 */
/* global it, expect */
const { setAccentColor, setAccentOnAppTheme } = require('../withAndroidAccent');

// The shape of res/values/styles.xml that `expo prebuild` writes for SDK 57, as parsed XML.
const styles = () => ({
  resources: {
    style: [
      {
        $: { name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' },
        item: [{ $: { name: 'colorPrimary' }, _: '@color/colorPrimary' }],
      },
    ],
  },
});

const items = (xml) => xml.resources.style.find((s) => s.$.name === 'AppTheme').item.map((i) => [i.$.name, i._]);

it('points AppTheme colorAccent at the colour resource, once', () => {
  const once = setAccentOnAppTheme(styles());
  expect(items(once)).toEqual([
    ['colorPrimary', '@color/colorPrimary'],
    ['colorAccent', '@color/colorAccent'],
  ]);
  expect(items(setAccentOnAppTheme(once))).toEqual(items(once));
});

it('writes the colour value, replacing an earlier one', () => {
  const colors = setAccentColor({ resources: {} }, '#6B3FA8');
  expect(colors.resources.color).toEqual([{ $: { name: 'colorAccent' }, _: '#6B3FA8' }]);
  expect(setAccentColor(colors, '#C4A8EE').resources.color).toEqual([{ $: { name: 'colorAccent' }, _: '#C4A8EE' }]);
});

it('uses the theme primaries in app.json', () => {
  const { lightColors, darkColors } = require('../../src/theme/tokens');
  const plugins = require('../../app.json').expo.plugins;
  const entry = plugins.find((p) => Array.isArray(p) && p[0] === './plugins/withAndroidAccent');
  expect(entry[1]).toEqual({ light: lightColors.primary, dark: darkColors.primary });
  expect(require('../../app.json').expo.primaryColor).toBe(lightColors.primary);
});
