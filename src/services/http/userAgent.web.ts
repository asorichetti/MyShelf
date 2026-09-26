export { formatUserAgent, PROJECT_URL } from './userAgent.shared';

/** Browsers refuse to let pages set `User-Agent`, so the web build sends none. */
export function userAgent(): string | undefined {
  return undefined;
}
