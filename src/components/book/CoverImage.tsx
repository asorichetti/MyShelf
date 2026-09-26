import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme, type CoverSize } from '@/theme';

import { GeneratedCover } from './GeneratedCover';

export interface CoverImageProps {
  uri?: string | null;
  title: string;
  author?: string | null;
  size?: CoverSize;
  /**
   * True (the default) when adjacent text already names the book, so the
   * cover is hidden from assistive tech. Otherwise it is an image labelled
   * "Cover of <title>".
   */
  decorative?: boolean;
  testID?: string;
}

/**
 * A book cover: the image when there is one (cached by expo-image), with the
 * generated cover underneath as the placeholder and as the fallback when the
 * image cannot load. A broken image is removed rather than left broken.
 */
export function CoverImage({ uri, title, author, size = 'thumb', decorative = true, testID }: CoverImageProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const { width, height } = theme.coverSizes[size];
  const showImage = Boolean(uri) && failedUri !== uri;
  const label = `Cover of ${title}`;

  return (
    <View
      testID={testID}
      {...(decorative
        ? { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { role: 'img' as const, accessible: true, accessibilityLabel: label, 'aria-label': label })}
      style={[styles.frame, { width, height, borderRadius: theme.radii.sm, boxShadow: theme.elevation.low }]}
    >
      <GeneratedCover title={title} author={author} size={size} />
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          alt=""
          accessibilityLabel=""
          contentFit="cover"
          transition={reduceMotion ? 0 : 150}
          onError={() => setFailedUri(uri!)}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radii.sm }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
