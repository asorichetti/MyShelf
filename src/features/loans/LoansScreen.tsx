import { Booky } from '@/components/booky';
import { EmptyState, Heading, Screen } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

export function LoansScreen() {
  return (
    <Screen testID={Testids.loans.root}>
      <Heading level={1} testID={Testids.loans.title}>
        Loans
      </Heading>
      <EmptyState
        illustration={<Booky expression="thinking" size={112} />}
        title="No books out on loan"
        message="When you lend a book I'll stamp the due date and remind you when it's time to ask for it back."
      />
    </Screen>
  );
}
