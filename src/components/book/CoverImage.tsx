import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Testids } from '@/testing/testids.gen';
import { useTheme, type CoverSize } from '@/theme';

import { GeneratedCover } from './GeneratedCover';

/** How long a loaded cover takes to fade in over its placeholder. */
export const COVER_FADE_MS = 200;

/**
 * An image this small is not a cover. Open Library answers a cover id it
 * does not have with `200 OK` and a transparent 1x1 GIF (unless the URL asks
 * for `default=false`), which would otherwise "load" as an empty tile.
 */
export const MIN_COVER_SIDE = 10;

/** True when an image that loaded is really a stand-in for "no cover". */
export function isPlaceholderImage(size: { width?: number; height?: number } | undefined): boolean {
  if (!size || !size.width || !size.height) return false;
  return size.width < MIN_COVER_SIDE || size.height < MIN_COVER_SIDE;
}

export interface CoverImageProps {
  uri?: string | null;
  title: string;
  author?: string | null;
  size?: CoverSize;
  /** A width that overrides `size`'s (the height keeps the 2:3 shape), e.g. to fill a grid cell. */
  width?: number;
  /**
   * True (the default) when adjacent text already names the book, so the
   * cover is hidden from assistive tech. Otherwise it is an image labelled
   * "Cover of <title>".
   */
  decorative?: boolean;
  testID?: string;
}

/**
 * A book cover. The real cover (`cover_uri`: a `file://` copy on the device, a
 * remote URL on web) is the golden path: it sits in a 2:3 frame on card
 * stock. While it loads, the generated cover stands in (so a slow network
 * shows a pleasant cover, not a blank tile) and the real one fades in over it. It is
 * fitted with `contain`, never cropped, so a cover with a different shape (or
 * one padded with white bars, as some Open Library scans are) shows whole on
 * the near-white card instead of losing its title or looking broken. Only
 * when there is no cover, or it fails to load (including a 1x1 "no cover"
 * image), does the generated cloth binding take its place for good.
 */
export function CoverImage({ uri, title, author, size = 'thumb', width: fitWidth, decorative = true, testID }: CoverImageProps) {
  const theme = useTheme();
  const { colors, radii } = theme;
  const reduceMotion = useReducedMotion();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const { width, height } = fitWidth ? { width: fitWidth, height: Math.round(fitWidth * 1.5) } : theme.coverSizes[size];
  const showImage = Boolean(uri) && failedUri !== uri;
  const loaded = showImage && loadedUri === uri;
  // The stand-in stays until the real cover has finished fading in over it.
  const [settledUri, setSettledUri] = useState<string | null>(null);
  const settled = loaded && settledUri === uri;
  useEffect(() => {
    if (!loaded || settled) return;
    const timer = setTimeout(() => setSettledUri(uri!), reduceMotion ? 0 : COVER_FADE_MS);
    return () => clearTimeout(timer);
  }, [loaded, settled, uri, reduceMotion]);
  const label = `Cover of ${title}`;

  return (
    <View
      testID={testID}
      {...(decorative
        ? { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { role: 'img' as const, accessible: true, accessibilityLabel: label, 'aria-label': label })}
      style={[
        styles.frame,
        {
          width,
          height,
          borderRadius: radii.sm,
          boxShadow: theme.elevation.low,
          backgroundColor: showImage ? colors.surface : 'transparent',
          borderColor: showImage ? colors.border : 'transparent',
        },
      ]}
    >
      {showImage ? (
        <>
          {settled ? null : (
            <View testID={Testids.cover.placeholder} style={StyleSheet.absoluteFill}>
              <GeneratedCover title={title} author={author} size={size} width={width} height={height} />
            </View>
          )}
          <Image
            testID={Testids.cover.image}
            source={{ uri: uri! }}
            alt=""
            accessibilityLabel=""
            contentFit="contain"
            // A device file can be replaced in place (a new photo of the cover), so it is never cached.
            cachePolicy={uri!.startsWith('file:') ? 'none' : 'disk'}
            transition={reduceMotion ? 0 : COVER_FADE_MS}
            onLoad={(event) => (isPlaceholderImage(event?.source) ? setFailedUri(uri!) : setLoadedUri(uri!))}
            onError={() => setFailedUri(uri!)}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <GeneratedCover title={title} author={author} size={size} width={width} height={height} testID={Testids.cover.fallback} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
