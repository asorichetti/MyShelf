import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text, View } from 'react-native';

import { SeriesEventHost } from '@/features/series/SeriesEventHost';
import { publishSeriesMilestone } from '@/features/series/seriesEvents';
import { AppTestProviders } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function Layout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <SeriesEventHost />
    </View>
  );
}

function renderHost() {
  return renderRouter(
    { _layout: Layout, index: () => <Text>home</Text>, 'series/[id]': () => <Text>series page</Text> },
    { initialUrl: '/', wrapper: AppTestProviders },
  );
}

const gap = { type: 'series-gap' as const, seriesId: 3, seriesName: 'Discworld', owned: [1, 3], gaps: [2], message: 'You have #1 and #3 of Discworld — #2 is missing.' };
const complete = { type: 'series-complete' as const, seriesId: 3, seriesName: 'Discworld', total: 3, message: 'Series complete! All 3 Discworld books.' };

describe('SeriesEventHost', () => {
  it('shows nothing until a milestone arrives', () => {
    renderHost();
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
    expect(screen.queryByTestId(Testids.seriesCelebration.root)).toBeNull();
  });

  it('shows the gap tip with thinking Booky and opens the series', async () => {
    const r = renderHost();
    act(() => publishSeriesMilestone(gap));
    expect(screen.getByTestId(Testids.seriesTip.text)).toHaveTextContent(gap.message);
    expect(screen.getByLabelText('Booky the bookmark, thinking')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.seriesTip.open)));
    expect(r.getPathname()).toBe('/series/3');
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
  });

  it('dismisses the tip', () => {
    renderHost();
    act(() => publishSeriesMilestone(gap));
    fireEvent.press(screen.getByTestId(Testids.seriesTip.dismiss));
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
  });

  it('celebrates a completed series, and a later tip does not cover the celebration', () => {
    renderHost();
    act(() => publishSeriesMilestone(complete));
    expect(screen.getByTestId(Testids.seriesCelebration.text)).toHaveTextContent(complete.message);
    act(() => publishSeriesMilestone({ ...gap, seriesId: 9 }));
    expect(screen.getByTestId(Testids.seriesCelebration.root)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.seriesTip.root)).toBeNull();
    fireEvent.press(screen.getByTestId(Testids.seriesCelebration.dismiss));
    expect(screen.queryByTestId(Testids.seriesCelebration.root)).toBeNull();
  });
});
