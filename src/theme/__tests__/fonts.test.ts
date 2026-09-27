import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { appFonts } from '../fonts';
import { fontFamilies } from '../tokens';

// The real icon set (jest.setup.ts replaces it with a placeholder); babel-jest
// hoists this above the imports.
jest.unmock('@expo/vector-icons/MaterialCommunityIcons');

describe('appFonts', () => {
  it('has every family the typography uses', () => {
    for (const family of Object.values(fontFamilies)) expect(appFonts).toHaveProperty(family);
  });

  // The root layout waits for appFonts; an icon font loaded later changes
  // widths after the first layout, which Android can draw clipped.
  it('preloads the icon font with the text fonts', () => {
    const families = Object.keys(MaterialCommunityIcons.font);
    expect(families).toEqual(['material-community']);
    for (const family of families) expect(appFonts).toHaveProperty(family);
  });
});
