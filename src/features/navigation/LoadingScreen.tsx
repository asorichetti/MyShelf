import { Booky } from '@/components/booky';
import { EmptyState, Screen } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

/** Shown while the database opens and migrates (web has no native splash to cover it). */
export function LoadingScreen() {
  return (
    <Screen pageState="loading" testID={Testids.loading.root} centered scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <EmptyState
        illustration={<Booky expression="thinking" size={96} />}
        headingLevel={1}
        title="Opening your library…"
        titleTestID={Testids.loading.title}
      />
    </Screen>
  );
}
