import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { BookyBubble } from '@/components/booky';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export interface UsePhotoAsCoverProps {
  /** The photo taken (or chosen) to read the cover. */
  photoUri: string;
  title: string;
  onUse: () => void;
  onDecline: () => void;
  /** While the photo is being stored: the buttons wait. */
  busy?: boolean;
}

/**
 * "Use my photo as the cover?" (P03-14): no cover for the book could be found
 * online, so Booky offers the photo that found it, shown as it would be
 * stored (the middle of the photo, cropped to a cover's 2:3).
 */
export function UsePhotoAsCover({ photoUri, title, onUse, onDecline, busy = false }: UsePhotoAsCoverProps) {
  const { spacing, radii, coverSizes, colors } = useTheme();
  const size = coverSizes.medium;
  return (
    <View testID={Testids.coverPhoto.offer} style={[styles.row, { gap: spacing.md }]}>
      <Image
        source={{ uri: photoUri }}
        alt={t('scan.coverPhoto.photoAlt', { title })}
        contentFit="cover"
        style={{ width: size.width, height: size.height, borderRadius: radii.sm, backgroundColor: colors.surface }}
      />
      <BookyBubble
        style={styles.fill}
        expression="happy"
        message={t('scan.coverPhoto.message', { title })}
        actions={
          busy
            ? []
            : [
                { label: t('scan.coverPhoto.use'), onPress: onUse, testID: Testids.coverPhoto.use, variant: 'primary' },
                { label: t('scan.coverPhoto.decline'), onPress: onDecline, testID: Testids.coverPhoto.decline, variant: 'ghost' },
              ]
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  fill: { flexGrow: 1, flexBasis: 220 },
});
