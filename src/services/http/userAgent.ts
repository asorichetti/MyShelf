import Constants from 'expo-constants';

import { formatUserAgent } from './userAgent.shared';

/** The User-Agent header for this platform: native apps send `MyShelf/<app version> (+<repo>)`. */
export function userAgent(): string | undefined {
  return formatUserAgent(Constants.expoConfig?.version);
}
