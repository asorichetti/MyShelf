/** 32-bit FNV-1a hash of a string: stable across runs, platforms and app versions. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Picks one of `count` colours for a title: the same title (ignoring case and
 * surrounding spaces) always gets the same index.
 */
export function hashColour(title: string, count: number): number {
  if (count <= 0) throw new RangeError('count must be positive');
  return hashString(title.trim().toLowerCase()) % count;
}
