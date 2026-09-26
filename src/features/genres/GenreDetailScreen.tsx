import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { BookRow } from '@/components/book/BookRow';
import { Heading, Screen, Text, TopBar } from '@/components/ui';
import { goBackOr } from '@/features/navigation/goBack';
import { LoadingPage } from '@/features/navigation/LoadingPage';
import { MissingScreen } from '@/features/navigation/MissingScreen';
import { parseId } from '@/features/navigation/parseId';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useGenre } from './useGenre';

/** `/genres/[id]`: the books in one genre, A-Z. */
export function GenreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useGenre(parseId(id));
  const { spacing } = useTheme();
  const open = useCallback((bookId: number) => router.navigate({ pathname: '/book/[id]', params: { id: String(bookId) } }), []);

  if (state.status === 'loading') return <LoadingPage />;
  if (state.status === 'missing') {
    return <MissingScreen title="Genre not found" message="That genre isn’t in your catalogue any more. It may have been merged or deleted." fallback="/genres" />;
  }
  const { genre, items } = state;
  return (
    <Screen testID={Testids.genres.detail} edges={['top', 'bottom', 'left', 'right']}>
      <TopBar onBack={() => goBackOr('/genres')} />
      <View style={{ gap: spacing.xs }}>
        <Text variant="stamp" color="accent">
          Genre
        </Text>
        <Heading level={1} testID={Testids.genres.detailTitle}>
          {genre.name}
        </Heading>
        <Text color="inkMuted">{items.length === 1 ? '1 book' : `${items.length} books`}</Text>
      </View>
      <View role="list" aria-label={`Books in ${genre.name}`} style={{ gap: spacing.md }}>
        {items.map((item) => (
          <View key={item.id} role="listitem">
            <BookRow item={item} onPress={open} />
          </View>
        ))}
      </View>
      {items.length === 0 ? <Text color="inkMuted">No books have this genre yet.</Text> : null}
    </Screen>
  );
}
