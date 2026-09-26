import { useState } from 'react';
import { View } from 'react-native';

import { StarRating, Text, useSnackbar } from '@/components/ui';
import { booksRepo, useDatabase } from '@/db';
import { ratingAnnouncement, type Rating } from '@/domain';
import { emit } from '@/features/events';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

/**
 * The detail page's "Your rating" (P10-03): tap a star (or use the keys, or
 * TalkBack's swipe up and down) and it is saved at once, with "Rated 4
 * stars" said politely. The stars move straight away; if the save fails
 * they go back and a snackbar says so.
 */
export function BookRating({ bookId, rating }: { bookId: number; rating: number | null }) {
  const db = useDatabase();
  const { spacing } = useTheme();
  const { show } = useSnackbar();
  const [value, setValue] = useState<number | null>(rating);
  const [stored, setStored] = useState<number | null>(rating);
  const [status, setStatus] = useState('');

  // The stored rating wins whenever it changes underneath (another screen, a restore).
  if (rating !== stored) {
    setStored(rating);
    setValue(rating);
  }

  const change = async (next: Rating | null) => {
    const before = value;
    setValue(next);
    try {
      await booksRepo.setRating(db, bookId, next);
      setStatus(ratingAnnouncement(next));
      emit('library-changed');
    } catch (e) {
      console.error('Could not save the rating', e);
      setValue(before);
      show({ message: 'Sorry, I couldn’t save that rating. Please try again.' });
    }
  };

  return (
    <View style={{ gap: spacing.xxs }}>
      <StarRating value={value} onChange={change} />
      <Text
        variant="caption"
        color="inkMuted"
        role="status"
        aria-live="polite"
        accessibilityLiveRegion="polite"
        testID={Testids.rating.status}
      >
        {status || (value == null ? 'Tap a star to rate this book.' : ' ')}
      </Text>
    </View>
  );
}
