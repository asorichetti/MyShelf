import { Booky } from '@/components/booky';
import { EmptyState, Heading, Screen } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';

export function ScanScreen() {
  return (
    <Screen testID={Testids.scan.root}>
      <Heading level={1} testID={Testids.scan.title}>
        Scan a book
      </Heading>
      <EmptyState
        illustration={<Booky expression="excited" size={112} />}
        title="Ready when you are"
        message="Soon you'll point your camera at a barcode or cover and I'll look the book up."
      />
    </Screen>
  );
}
