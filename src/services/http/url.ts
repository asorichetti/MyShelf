/**
 * `base?key=value&…` with RFC 3986 encoding. Empty values are skipped. Built by
 * hand because React Native's URLSearchParams has historically been incomplete.
 */
export function withQuery(base: string, params: Record<string, string | number | null | undefined>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return query ? `${base}${base.includes('?') ? '&' : '?'}${query}` : base;
}
