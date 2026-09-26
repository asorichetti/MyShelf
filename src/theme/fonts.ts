import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';

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
