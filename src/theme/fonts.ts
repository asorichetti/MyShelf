// Import each weight from its own subpath: the package index requires every
// weight, which would bundle all of the family's font files into the app.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular';
import { CourierPrime_700Bold } from '@expo-google-fonts/courier-prime/700Bold';
import { Lora_500Medium } from '@expo-google-fonts/lora/500Medium';
import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold';
import { Lora_700Bold } from '@expo-google-fonts/lora/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_400Regular_Italic } from '@expo-google-fonts/nunito/400Regular_Italic';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';

import { fontFamilies } from './tokens';

/**
 * Font assets keyed by the family names used in `fontFamilies`, plus the icon
 * font. The root layout waits for all of them before drawing anything. The
 * icon font must be among them: `@expo/vector-icons` otherwise loads it on
 * first use, after the first layout, and on Android a label measured beside
 * the still-empty icon keeps that narrower layout when the icon arrives
 * ("Save to shelf" drew as "Save to" on a screen opened straight from a cold
 * start).
 */
export const appFonts = {
  ...MaterialCommunityIcons.font,
  [fontFamilies.headingRegular]: Lora_500Medium,
  [fontFamilies.heading]: Lora_600SemiBold,
  [fontFamilies.headingBold]: Lora_700Bold,
  [fontFamilies.body]: Nunito_400Regular,
  [fontFamilies.bodyItalic]: Nunito_400Regular_Italic,
  [fontFamilies.bodySemiBold]: Nunito_600SemiBold,
  [fontFamilies.bodyBold]: Nunito_700Bold,
  [fontFamilies.mono]: CourierPrime_400Regular,
  [fontFamilies.monoBold]: CourierPrime_700Bold,
};
