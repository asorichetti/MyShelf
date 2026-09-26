import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Testids } from '@/testing/testids.gen';
import { useTheme, type CoverSize } from '@/theme';

import { GeneratedCover } from './GeneratedCover';

/** How long a loaded cover takes to fade in over its placeholder. */
export const COVER_FADE_MS = 200;

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
 * stock, with a soft placeholder while it loads and a short fade-in. It is
 * fitted with `contain`, never cropped, so a cover with a different shape (or
 * one padded with white bars, as some Open Library scans are) shows whole on
 * the near-white card instead of losing its title or looking broken. Only
 * when there is no cover, or it fails to load, does the generated cloth
 * binding take its place.
 */
export function CoverImage({ uri, title, author, size = 'thumb', width: fitWidth, decorative = true, testID }: CoverImageProps) {
  const theme = useTheme();
  const { colors, radii, sizes } = theme;
  const reduceMotion = useReducedMotion();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const { width, height } = fitWidth ? { width: fitWidth, height: Math.round(fitWidth * 1.5) } : theme.coverSizes[size];
  const showImage = Boolean(uri) && failedUri !== uri;
  const loaded = showImage && loadedUri === uri;
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
          {loaded ? null : (
            <View testID={Testids.cover.placeholder} style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.surfaceTint }]}>
              <MaterialCommunityIcons name="book-open-page-variant-outline" size={Math.min(width / 2, sizes.icon * 2)} color={colors.border} />
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
            onLoad={() => setLoadedUri(uri!)}
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
  center: { alignItems: 'center', justifyContent: 'center' },
});
