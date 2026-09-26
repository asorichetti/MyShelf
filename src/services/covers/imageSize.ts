/** Pixel size of an image, read from its header bytes (no decoding). */
export interface ImageSize {
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'gif' | 'webp';
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function pngSize(b: Uint8Array): ImageSize | null {
  // Signature (8 bytes), then the IHDR chunk: length (4), "IHDR", width (4), height (4).
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return null;
  return { width: u32be(b, 16), height: u32be(b, 20), format: 'png' };
}

function gifSize(b: Uint8Array): ImageSize | null {
  if (b.length < 10) return null;
  return { width: u16le(b, 6), height: u16le(b, 8), format: 'gif' };
}

/** Start-of-frame markers carry the size; C4 (DHT), C8 (JPG) and CC (DAC) share the range but are not frames. */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function jpegSize(b: Uint8Array): ImageSize | null {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null; // lost sync: not a well-formed JPEG
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // Markers without a length: TEM, RST0–7, SOI, EOI.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    if (isStartOfFrame(marker)) {
      // Segment: length (2), precision (1), height (2), width (2).
      if (i + 9 > b.length) return null;
      return { width: u16be(b, i + 7), height: u16be(b, i + 5), format: 'jpeg' };
    }
    if (marker === 0xda) return null; // start of scan before any frame header
    i += 2 + length;
  }
  return null;
}

function webpSize(b: Uint8Array): ImageSize | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, format: 'webp' };
  if (chunk === 'VP8L') {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, format: 'webp' };
  }
  if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1, format: 'webp' };
  return null;
}

/**
 * Width, height and format of a JPEG, PNG, GIF or WebP image from its first
 * bytes, or null when the bytes are not one of those (an HTML error page, a
 * truncated download). Only the header is read; nothing is decoded.
 */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpegSize(b);
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return pngSize(b);
  if (b.length >= 6 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')) return gifSize(b);
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return webpSize(b);
  return null;
}
