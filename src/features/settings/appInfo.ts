import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** The app's version from app.json ("1.0.0"). */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

/** "Android build 3", "Web build": which build this is, for the About screen. */
export function appBuild(): string {
  const code = Constants.expoConfig?.android?.versionCode;
  if (Platform.OS === 'android') return code ? `Android build ${code}` : 'Android build';
  if (Platform.OS === 'web') return 'Web build';
  return `${Platform.OS} build`;
}

/** Whether this build was made with a Google Books API key. The key itself is never shown or stored. */
export const GOOGLE_BOOKS_KEYED = Boolean(process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY);

export const REPO_URL = 'https://github.com/asorichetti/MyShelf';
export const PRIVACY_URL = `${REPO_URL}/blob/main/docs/adr/0012-local-only-data.md`;
