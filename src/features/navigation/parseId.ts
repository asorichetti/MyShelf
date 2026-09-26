/** Parses a route's `id` param; null when it is not a positive whole number. */
export function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
}
