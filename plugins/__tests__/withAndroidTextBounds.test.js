/**
 * @jest-environment node
 */
/* global it, expect */
const { setTextViewStyle } = require('../withAndroidTextBounds');

const styles = () => ({
  resources: {
    style: [{ $: { name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' }, item: [{ $: { name: 'colorPrimary' }, _: '@color/colorPrimary' }] }],
  },
});

const style = (xml, name) => xml.resources.style.find((s) => s.$.name === name);

it('gives TextViews a default style that lays text out by advances, as React Native measures it', () => {
  const out = setTextViewStyle(styles());
  const text = style(out, 'MyShelfTextView');
  expect(text.$.parent).toBe('android:Widget.Material.TextView');
  expect(text.item).toEqual([{ $: { name: 'android:useBoundsForWidth', 'tools:targetApi': '35' }, _: 'false' }]);
  expect(style(out, 'AppTheme').item).toContainEqual({ $: { name: 'android:textViewStyle' }, _: '@style/MyShelfTextView' });
  // Running it twice changes nothing.
  expect(setTextViewStyle(out)).toEqual(out);
});
