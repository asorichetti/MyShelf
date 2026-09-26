import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tiny generated images (solid colour, made for these tests; no real cover
 * art). JPEGs were written by macOS `sips`, so they carry JFIF and Exif
 * segments before the frame header, like real downloads.
 */
const load = (name: string) => new Uint8Array(readFileSync(join(__dirname, name)));

export const images = {
  portrait320: load('portrait-320x480.jpg'),
  large800: load('large-800x1200.jpg'),
  square300: load('square-300x300.jpg'),
  small128: load('small-128x100.jpg'),
  thumb128: load('thumb-128x200.jpg'),
  strip575: load('strip-575x92.jpg'),
  png400: load('portrait-400x600.png'),
  pixelGif: load('pixel-1x1.gif'),
};
