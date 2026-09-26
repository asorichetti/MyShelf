import { router, type Href } from 'expo-router';

/** Back to wherever the user came from, or `fallback` when the page was opened directly. */
export function goBackOr(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
