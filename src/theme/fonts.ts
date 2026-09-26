// Import each weight from its own subpath: the package index requires every
// weight, which would bundle all ~36 font files into the app.
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_400Regular_Italic } from '@expo-google-fonts/nunito/400Regular_Italic';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';

import { fontFamilies } from './tokens';

/** Font assets keyed by the family names used in `fontFamilies`. */
export const appFonts = {
  [fontFamilies.headingRegular]: Fraunces_500Medium,
  [fontFamilies.heading]: Fraunces_600SemiBold,
  [fontFamilies.headingBold]: Fraunces_700Bold,
  [fontFamilies.body]: Nunito_400Regular,
  [fontFamilies.bodyItalic]: Nunito_400Regular_Italic,
  [fontFamilies.bodySemiBold]: Nunito_600SemiBold,
  [fontFamilies.bodyBold]: Nunito_700Bold,
};
