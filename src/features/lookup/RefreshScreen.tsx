import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { sourceLabels } from '@/components/book/CandidateCard';
import { RefreshFieldRow } from '@/components/book/RefreshFieldRow';
import { Booky, BookyBubble } from '@/components/booky';
import { Button, EmptyState, Heading, Screen, Text, TopBar, useSnackbar } from '@/components/ui';
import { BookMissing, goBackOrShelf } from '@/features/book/BookDetailScreen';
import { parseId } from '@/features/navigation/parseId';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useRefresh } from './useRefresh';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

function Header({ title, onBack }: { title: string | null; onBack: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <TopBar onBack={onBack} backLabel="Back to the book" />
      <Heading level={1}>Refresh details</Heading>
      {title ? <Text color="inkMuted">{title}</Text> : null}
    </View>
  );
}

/** `/book/[id]/refresh` (P02-12): look a book up again and choose which details to update. */
export function RefreshScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = parseId(id);
  const refresh = useRefresh(bookId);
  const { state, ticked } = refresh;
  const { spacing } = useTheme();
  const { show } = useSnackbar();

  if (state.status === 'missing') return <BookMissing />;
  if (state.status === 'loading') {
    return (
      <Screen pageState="loading" centered edges={[...EDGES]}>
        <BookyBubble expression="thinking" message="Checking the library catalogues for anything new…" />
      </Screen>
    );
  }

  const apply = async () => {
    try {
      const n = await refresh.apply();
      goBackOrShelf();
      show({ message: n === 1 ? 'Updated 1 detail' : `Updated ${n} details` });
    } catch (e) {
      console.error('Could not refresh the book', e);
      show({ message: 'Sorry, I couldn’t save those changes. Please try again.' });
    }
  };

  const title = state.status === 'error' ? state.book?.title ?? null : state.book.title;
  return (
    <Screen testID={Testids.refresh.root} edges={[...EDGES]}>
      <Header title={title} onBack={goBackOrShelf} />
      {state.status === 'error' ? (
        <View role="alert">
          <BookyBubble expression="concerned" message={state.message} />
        </View>
      ) : null}
      {state.status === 'not-found' ? (
        <EmptyState
          illustration={<Booky expression="concerned" size={96} />}
          title="No catalogue knows this one"
          message="I couldn’t find this book online, so there’s nothing to refresh. Its card stays just as it is."
          action={{ label: 'Back to the book', onPress: goBackOrShelf }}
        />
      ) : null}
      {state.status === 'ready' && !state.changes.length ? (
        <View testID={Testids.refresh.noChanges}>
          <EmptyState
            illustration={<Booky expression="happy" size={96} />}
            title="Everything’s up to date"
            message={`${sourceLabels[state.candidate.source]} has nothing to add to this card.`}
            action={{ label: 'Back to the book', onPress: goBackOrShelf }}
          />
        </View>
      ) : null}
      {state.status === 'ready' && state.changes.length ? (
        <View style={{ gap: spacing.md }}>
          <Text>
            {`${sourceLabels[state.candidate.source]} has ${state.changes.length === 1 ? 'one change' : `${state.changes.length} changes`}. Tick the ones you want; your own genres always stay.`}
          </Text>
          <View role="group" aria-label="Changes to apply" style={{ gap: spacing.sm }}>
            {state.changes.map((change) => (
              <RefreshFieldRow key={change.field} change={change} checked={ticked.has(change.field)} onToggle={() => refresh.toggle(change.field)} />
            ))}
          </View>
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <Button variant="ghost" label="Cancel" onPress={() => (router.canGoBack() ? router.back() : goBackOrShelf())} testID={Testids.refresh.cancel} />
            <Button
              label={ticked.size ? `Update ${ticked.size === 1 ? '1 detail' : `${ticked.size} details`}` : 'Nothing ticked'}
              onPress={apply}
              disabled={!ticked.size}
              loading={refresh.applying}
              testID={Testids.refresh.apply}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap' },
});
