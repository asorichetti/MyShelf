// Config plugin: gives the Android theme the app's own accent colour.
//
// Without it the generated AppTheme has AppCompat's default teal accent,
// which Android draws in the native parts of the app: the date picker the
// lend and return sheets open (header, selected day, OK and CANCEL), and the
// text cursor and selection handles in every text field. The accent is the
// theme's primary in light mode and its lighter night primary in dark mode
// (values-night), matching src/theme/tokens.ts; on those the Material date
// picker's header text (the inverse text colour) stays readable.
//
//   ["./plugins/withAndroidAccent", { "light": "#6B3FA8", "dark": "#C4A8EE" }]
const { AndroidConfig, withAndroidColors, withAndroidColorsNight, withAndroidStyles } = require('expo/config-plugins');

const COLOR = 'colorAccent';

/** Adds or replaces the colorAccent item on AppTheme in a styles.xml object. Exported for tests. */
function setAccentOnAppTheme(styles) {
  return AndroidConfig.Styles.assignStylesValue(styles, {
    add: true,
    parent: AndroidConfig.Styles.getAppThemeGroup(),
    name: COLOR,
    value: `@color/${COLOR}`,
  });
}

/** Adds or replaces the colorAccent colour in a colors.xml object. Exported for tests. */
function setAccentColor(colors, value) {
  return AndroidConfig.Colors.assignColorValue(colors, { name: COLOR, value });
}

function withAndroidAccent(config, { light, dark } = {}) {
  if (!light) throw new Error('withAndroidAccent: give a "light" colour (and optionally "dark").');
  config = withAndroidColors(config, (c) => {
    c.modResults = setAccentColor(c.modResults, light);
    return c;
  });
  config = withAndroidColorsNight(config, (c) => {
    c.modResults = setAccentColor(c.modResults, dark ?? light);
    return c;
  });
  return withAndroidStyles(config, (c) => {
    c.modResults = setAccentOnAppTheme(c.modResults);
    return c;
  });
}

module.exports = withAndroidAccent;
module.exports.setAccentOnAppTheme = setAccentOnAppTheme;
module.exports.setAccentColor = setAccentColor;
