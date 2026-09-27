// Config plugin: the window background behind the app follows dark mode.
//
// expo-system-ui points AppTheme's android:windowBackground at
// @color/activityBackground, which it fills from app.json's backgroundColor
// (the light paper). Android draws that window before React has drawn
// anything, so a phone in dark mode would show light paper between the
// splash and the first screen. This adds the night paper as the values-night
// colour, matching darkColors.paper in src/theme/tokens.ts. Once the app
// runs, RootBackground (src/theme) paints the root view with the resolved
// theme's paper, so an in-app Light or Dark choice is followed too.
//
//   ["./plugins/withAndroidNightBackground", { "dark": "#1C1424" }]
const { AndroidConfig, withAndroidColorsNight } = require('expo/config-plugins');

const COLOR = 'activityBackground';

/** Adds or replaces the activityBackground colour in a colors.xml object. Exported for tests. */
function setBackgroundColor(colors, value) {
  return AndroidConfig.Colors.assignColorValue(colors, { name: COLOR, value });
}

function withAndroidNightBackground(config, { dark } = {}) {
  if (!dark) throw new Error('withAndroidNightBackground: give a "dark" colour.');
  return withAndroidColorsNight(config, (c) => {
    c.modResults = setBackgroundColor(c.modResults, dark);
    return c;
  });
}

module.exports = withAndroidNightBackground;
module.exports.setBackgroundColor = setBackgroundColor;
