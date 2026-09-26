import { router } from 'expo-router';
import { View } from 'react-native';

import { Booky, useBooky } from '@/components/booky';
import { Button, EmptyState, Heading, Screen, Text } from '@/components/ui';
import { Testids } from '@/testing/testids.gen';
import { useTheme } from '@/theme';

export function ShelfScreen() {
  const theme = useTheme();
  const { showTip } = useBooky();
  return (
    <Screen testID={Testids.home.root}>
      <View style={{ gap: theme.spacing.xs }}>
        <Heading level={1} testID={Testids.home.title}>
          MyShelf
        </Heading>
        <Text color="inkMuted">Your personal library, one shelf at a time.</Text>
      </View>
      <EmptyState
        illustration={<Booky expression="happy" size={120} />}
        title="Your shelf is empty"
        message="Scan a book's barcode or cover and I'll fill in the title, author, genre and series for you."
        action={{ label: 'Scan a book', onPress: () => router.navigate('/scan'), testID: Testids.home.scanAction }}
      />
      <Button
        variant="ghost"
        label="What can Booky do?"
        testID={Testids.home.askBooky}
        style={{ alignSelf: 'center' }}
        onPress={() =>
          showTip({
            title: 'Hi, I’m Booky!',
            message: 'I keep track of your books, who has borrowed them, and which series you’re part-way through.',
            expression: 'excited',
          })
        }
      />
    </Screen>
  );
}
