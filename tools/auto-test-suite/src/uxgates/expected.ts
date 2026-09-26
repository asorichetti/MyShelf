// ExpectedMissingMarker is embedded in URLs that a journey requests knowing
// they do not exist (the 404 journey, the demo fixture's broken cover). The
// console and network gates skip anything whose URL or text contains it, and
// the render gate's images rule skips images whose URL does. Defined once, read by both, so the
// exemption is precise instead of an allowlist rule that hides every real 404.
export const ExpectedMissingMarker = '__expected-404';

/** Whether s refers to a deliberately missing URL. */
export function isExpectedMissing(s: string | undefined): boolean {
  return !!s && s.includes(ExpectedMissingMarker);
}
