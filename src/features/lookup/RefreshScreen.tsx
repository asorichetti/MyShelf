import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { sourceLabels } from '@/components/book/CandidateCard';
import { RefreshFieldRow } from '@/components/book/RefreshFieldRow';
import { Booky, BookyBubble } from '@/components/booky';
import { Button, EmptyState, Heading, Screen, Text, TopBar, useSnackbar } from '@/components/ui';
import { BookMissing, goBackOrShelf } from '@/features/book/BookDetailScreen';
import { parseId } from '@/features/navigation/parseId';
import { t } from '@/i18n';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

import { useRefresh } from './useRefresh';

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

function Header({ title, onBack }: { title: string | null; onBack: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <TopBar onBack={onBack} backLabel={t('refresh.backToBook')} />
      <Heading level={1}>{t('refresh.title')}</Heading>
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
        <BookyBubble expression="thinking" message={t('refresh.checking')} />
      </Screen>
    );
  }

  const apply = async () => {
    try {
      const n = await refresh.apply();
      if (n === null) return; // a second tap while the first is saving
      goBackOrShelf();
      show({ message: t('refresh.updated', { count: n }) });
    } catch (e) {
      console.error('Could not refresh the book', e);
      show({ message: t('refresh.saveFailed') });
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
          title={t('refresh.notFoundTitle')}
          message={t('refresh.notFoundMessage')}
          action={{ label: t('refresh.backToBook'), onPress: goBackOrShelf }}
        />
      ) : null}
      {state.status === 'ready' && !state.changes.length ? (
        <View testID={Testids.refresh.noChanges}>
          <EmptyState
            illustration={<Booky expression="happy" size={96} />}
            title={t('refresh.upToDateTitle')}
            message={t('refresh.upToDateMessage', { source: sourceLabels[state.candidate.source] })}
            action={{ label: t('refresh.backToBook'), onPress: goBackOrShelf }}
          />
        </View>
      ) : null}
      {state.status === 'ready' && state.changes.length ? (
        <View style={{ gap: spacing.md }}>
          <Text>
            {t('refresh.changes', { count: state.changes.length, source: sourceLabels[state.candidate.source] })}
          </Text>
          <View role="group" aria-label={t('refresh.changesLabel')} style={{ gap: spacing.sm }}>
            {state.changes.map((change) => (
              <RefreshFieldRow key={change.field} change={change} checked={ticked.has(change.field)} onToggle={() => refresh.toggle(change.field)} />
            ))}
          </View>
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <Button variant="ghost" label={t('common.cancel')} onPress={() => (router.canGoBack() ? router.back() : goBackOrShelf())} testID={Testids.refresh.cancel} />
            <Button
              label={ticked.size ? t('refresh.update', { count: ticked.size }) : t('refresh.nothingTicked')}
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
