import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Heading, Text } from '@/components/ui';
import { artworkTypography, lightTheme, scaleTheme, scaleTypography, ThemeProvider, typographyMaxScale, useFontScale, useTheme } from '@/theme';

import type { ReactNode } from 'react';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function at(fontScale: number, children: ReactNode) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider scheme="light" fontScale={fontScale}>
        {children}
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('scaleTypography (P09-01, the web large-text emulation)', () => {
  it('doubles sizes and line heights at 200 %, keeping letter spacing', () => {
    const t = scaleTypography(lightTheme.typography, 2);
    expect(t.body).toMatchObject({ fontSize: 32, lineHeight: 48, fontFamily: lightTheme.typography.body.fontFamily });
    expect(t.h1).toMatchObject({ fontSize: 56, lineHeight: 72, letterSpacing: lightTheme.typography.h1.letterSpacing });
  });

  it('stops tab labels at their cap', () => {
    expect(typographyMaxScale.tabLabel).toBe(1.5);
    expect(scaleTypography(lightTheme.typography, 2).tabLabel).toMatchObject({ fontSize: 18, lineHeight: 24 });
  });

  it('leaves the theme alone at 100 %, and artwork lettering always', () => {
    expect(scaleTheme(lightTheme, 1)).toBe(lightTheme);
    expect(scaleTheme(lightTheme, 2).colors).toBe(lightTheme.colors);
    expect(artworkTypography).toBe(lightTheme.typography);
  });
});

describe('ThemeProvider fontScale', () => {
  function Probe() {
    const scale = useFontScale();
    const theme = useTheme();
    return <Text testID="probe">{`${scale} ${theme.typography.body.fontSize}`}</Text>;
  }

  it('reports the scale; on a phone the system scales text, so the tokens stay as designed', () => {
    at(2, <Probe />);
    // The platform module is the native one in Jest: Android scales Text itself.
    expect(screen.getByTestId('probe')).toHaveTextContent('2 16');
  });
});

describe('Text and Heading at a large font size', () => {
  it('show as much text as at 100 %: a two-line clamp becomes four lines at 200 %', () => {
    at(
      2,
      <>
        <Text testID="t" numberOfLines={2}>
          A long title
        </Text>
        <Heading testID="h" level={2} numberOfLines={1}>
          Section
        </Heading>
        <Text testID="free">No clamp</Text>
      </>,
    );
    expect(screen.getByTestId('t').props.numberOfLines).toBe(4);
    expect(screen.getByTestId('h').props.numberOfLines).toBe(2);
    expect(screen.getByTestId('free').props.numberOfLines).toBeUndefined();
  });

  it('keep the clamp at 100 %', () => {
    at(1, <Text testID="t" numberOfLines={2}>A long title</Text>);
    expect(screen.getByTestId('t').props.numberOfLines).toBe(2);
  });

  it('cap a capped variant on the phone too (maxFontSizeMultiplier), and its clamp with it', () => {
    at(
      2,
      <>
        <Text testID="tab" variant="tabLabel" numberOfLines={1}>
          Settings
        </Text>
        <Text testID="body">Body</Text>
      </>,
    );
    expect(screen.getByTestId('tab').props.maxFontSizeMultiplier).toBe(1.5);
    expect(screen.getByTestId('tab').props.numberOfLines).toBe(1);
    expect(screen.getByTestId('body').props.maxFontSizeMultiplier).toBeUndefined();
  });
});
