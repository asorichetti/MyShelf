// Config plugin: Android text views lay out text by glyph advances, as React
// Native measures it.
//
// React Native sizes each Text from a StaticLayout built without
// `useBoundsForWidth`. From Android 15, a TextView in an app targeting SDK 35
// or later lays text out with `useBoundsForWidth` on, so a glyph that reaches
// past its advance (the "f" ending "shelf", the "J" of "J. R. R. Tolkien")
// needs a few pixels more when drawn than it was measured with. The last word
// then wraps onto a second line the view has no height for, and disappears:
// "Save to shelf" drew as "Save to". This gives every TextView a default style
// with `useBoundsForWidth` off, so drawing matches the measurement. Older
// Android versions ignore the attribute (tools:targetApi keeps lint quiet).
const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

const STYLE = 'MyShelfTextView';

/** Adds the TextView style and points AppTheme's textViewStyle at it. Exported for tests. */
function setTextViewStyle(styles) {
  const { assignStylesValue, getAppThemeGroup } = AndroidConfig.Styles;
  styles = assignStylesValue(styles, {
    add: true,
    parent: { name: STYLE, parent: 'android:Widget.Material.TextView' },
    name: 'android:useBoundsForWidth',
    value: 'false',
    targetApi: '35',
  });
  return assignStylesValue(styles, {
    add: true,
    parent: getAppThemeGroup(),
    name: 'android:textViewStyle',
    value: `@style/${STYLE}`,
  });
}

const withAndroidTextBounds = (config) =>
  withAndroidStyles(config, (mod) => {
    mod.modResults = setTextViewStyle(mod.modResults);
    return mod;
  });

module.exports = withAndroidTextBounds;
module.exports.setTextViewStyle = setTextViewStyle;
