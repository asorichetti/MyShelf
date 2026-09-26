import { readImageSize, type ImageSize } from './imageSize';

/** Portrait (about 2:3, like a book), square (often a cover padded to a square), or anything else. */
export type CoverShape = 'portrait' | 'square' | 'odd';

export type CoverRejection =
  /** No bytes at all. */
  | 'empty'
  /** The server said it is not an image (an HTML error page, JSON). */
  | 'not-an-image'
  /** Bytes that are not a JPEG, PNG, GIF or WebP we can read. */
  | 'unreadable'
  /** 1×1 (or tiny) placeholder, e.g. Open Library without `default=false`. */
  | 'placeholder'
  /** Shorter than the minimum height. */
  | 'too-small'
  /** Far too wide or too tall for a front cover (e.g. a 575×92 strip). */
  | 'bad-shape'
  /** Google Books ignored the width asked for: its no-cover graphic does that. */
  | 'not-scalable';

export type CoverCheck = ({ ok: true } & ImageSize & { shape: CoverShape }) | { ok: false; reason: CoverRejection; size?: ImageSize };

export interface ValidateCoverOptions {
  /** Covers shorter than this are rejected. Default 150 px. */
  minHeight?: number;
  /**
   * Set when the URL asked Google Books for a width (`fife=w800`): an image
   * narrower than this did not scale, which is what Google's grey "no cover"
   * thumbnail (128×184) does. Default: no check.
   */
  minScaledWidth?: number;
}

export const MIN_COVER_HEIGHT = 150;

/** Width ÷ height bands. Real covers are near 2:3 (0.67); mass-market paperbacks about 0.62. */
export function coverShape(width: number, height: number): CoverShape {
  const aspect = width / height;
  if (aspect >= 0.5 && aspect <= 0.85) return 'portrait';
  if (aspect > 0.85 && aspect <= 1.15) return 'square';
  return 'odd';
}

/**
 * Checks downloaded bytes are a usable front cover: an image by content type
 * and by its header bytes, not a placeholder, tall enough, and not absurdly
 * shaped. Square images pass (Open Library has covers padded to squares,
 * e.g. 300×300) but rank below portrait ones.
 */
export function validateCover(
  bytes: Uint8Array,
  contentType: string | null,
  { minHeight = MIN_COVER_HEIGHT, minScaledWidth }: ValidateCoverOptions = {},
): CoverCheck {
  if (!bytes.length) return { ok: false, reason: 'empty' };
  const type = contentType?.split(';')[0].trim().toLowerCase();
  if (type && !type.startsWith('image/') && type !== 'application/octet-stream') return { ok: false, reason: 'not-an-image' };
  const size = readImageSize(bytes);
  if (!size) return { ok: false, reason: 'unreadable' };
  if (size.width <= 2 || size.height <= 2) return { ok: false, reason: 'placeholder', size };
  if (size.height < minHeight) return { ok: false, reason: 'too-small', size };
  const aspect = size.width / size.height;
  if (aspect < 0.33 || aspect > 1.5) return { ok: false, reason: 'bad-shape', size };
  if (minScaledWidth && size.width < minScaledWidth) return { ok: false, reason: 'not-scalable', size };
  return { ok: true, ...size, shape: coverShape(size.width, size.height) };
}

/** A cover good enough to stop looking: portrait and at least this tall. Open Library's large covers are 500 px. */
export const GOOD_COVER_HEIGHT = 400;

export function isGoodCover(check: { width: number; height: number; shape: CoverShape }): boolean {
  return check.shape === 'portrait' && check.height >= GOOD_COVER_HEIGHT;
}

const SHAPE_RANK: Record<CoverShape, number> = { portrait: 2, square: 1, odd: 0 };

/**
 * Orders two acceptable covers: portrait beats square beats odd; then the
 * taller one. Negative when `a` is better. Ties keep chain order (stable sort).
 */
export function compareCovers(a: { height: number; shape: CoverShape }, b: { height: number; shape: CoverShape }): number {
  return SHAPE_RANK[b.shape] - SHAPE_RANK[a.shape] || b.height - a.height;
}
