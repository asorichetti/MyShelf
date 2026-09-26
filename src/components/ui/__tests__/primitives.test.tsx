import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { ScrollView, Text as RNText } from 'react-native';

import { Button, Card, EmptyState, Heading, Screen, Text, TextField } from '@/components/ui';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
import { lightTheme } from '@/theme';

describe('Screen', () => {
  it('renders a main landmark inside the page-content marker', () => {
    renderWithTheme(
      <Screen testID="my-screen">
        <RNText>Hello</RNText>
      </Screen>,
    );
    const marker = screen.getByTestId(Testids.pageState.content);
    const main = screen.getByTestId('my-screen');
    expect(main.props.role).toBe('main');
    expect(marker).toContainElement(main);
    expect(screen.getByText('Hello')).toBeOnTheScreen();
  });

  it.each(['loading', 'error'] as const)('switches to the page-%s marker only', (state) => {
    renderWithTheme(
      <Screen pageState={state}>
        <RNText>State</RNText>
      </Screen>,
    );
    expect(screen.getByTestId(Testids.pageState[state])).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.pageState.content)).toBeNull();
  });

  it('scrolls by default and not when asked', () => {
    const { rerender } = renderWithTheme(
      <Screen>
        <RNText>Body</RNText>
      </Screen>,
    );
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(1);
    rerender(
      <Screen scroll={false}>
        <RNText>Body</RNText>
      </Screen>,
    );
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    expect(screen.getByText('Body')).toBeOnTheScreen();
  });
});

describe('Heading', () => {
  it.each([1, 2, 3] as const)('level %i exposes role heading with aria-level', (level) => {
    renderWithTheme(
      <Heading level={level} testID="h">
        Title {level}
      </Heading>,
    );
    const h = screen.getByRole('heading', { name: `Title ${level}` });
    expect(h.props['aria-level']).toBe(level);
    expect(h).toHaveStyle({ fontFamily: lightTheme.typography[`h${level}`].fontFamily });
  });

  it('defaults to level 1 in the primary colour', () => {
    renderWithTheme(<Heading testID="h">Main</Heading>);
    expect(screen.getByTestId('h').props['aria-level']).toBe(1);
    expect(screen.getByTestId('h')).toHaveStyle({ color: lightTheme.colors.primary });
  });
});

describe('Text', () => {
  it('applies variant typography and colour role', () => {
    renderWithTheme(
      <Text variant="caption" color="inkMuted" testID="t">
        Small print
      </Text>,
    );
    expect(screen.getByTestId('t')).toHaveStyle({
      fontSize: lightTheme.typography.caption.fontSize,
      color: lightTheme.colors.inkMuted,
    });
  });

  it('uppercases stamp text', () => {
    renderWithTheme(
      <Text variant="stamp" testID="t">
        Due
      </Text>,
    );
    expect(screen.getByTestId('t')).toHaveStyle({ textTransform: 'uppercase' });
  });
});

describe('Button', () => {
  it('has an accessible name and fires onPress', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button label="Add book" onPress={onPress} testID="btn" />);
    const btn = screen.getByRole('button', { name: 'Add book' });
    expect(btn).toBe(screen.getByTestId('btn'));
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('prefers an explicit accessibilityLabel', () => {
    renderWithTheme(<Button label="+" accessibilityLabel="Add a book" />);
    expect(screen.getByRole('button', { name: 'Add a book' })).toBeOnTheScreen();
  });

  it.each([
    ['primary', 'primary'],
    ['secondary', 'primaryContainer'],
    ['ghost', null],
    ['danger', 'danger'],
  ] as const)('renders the %s variant', (variant, bg) => {
    renderWithTheme(<Button label={variant} variant={variant} testID="btn" />);
    expect(screen.getByTestId('btn')).toHaveStyle({ backgroundColor: bg ? lightTheme.colors[bg] : 'transparent' });
    expect(screen.getByTestId('btn')).toHaveStyle({ minHeight: 48 });
  });

  it('does not fire when disabled and reports the state', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button label="Save" onPress={onPress} disabled testID="btn" />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn')).toBeDisabled();
  });

  it('is busy and disabled while loading', () => {
    renderWithTheme(<Button label="Save" loading testID="btn" />);
    expect(screen.getByTestId('btn')).toBeBusy();
    expect(screen.getByTestId('btn')).toBeDisabled();
  });
});

describe('Card', () => {
  it('renders a catalogue card with eyebrow, title heading and body', () => {
    renderWithTheme(
      <Card title="The Hobbit" eyebrow="FIC TOL" testID="card">
        <Text>J. R. R. Tolkien</Text>
      </Card>,
    );
    expect(screen.getByTestId('card')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'The Hobbit' }).props['aria-level']).toBe(2);
    expect(screen.getByText('FIC TOL')).toBeOnTheScreen();
    expect(screen.getByText('J. R. R. Tolkien')).toBeOnTheScreen();
  });

  it('becomes a button when pressable', () => {
    const onPress = jest.fn();
    renderWithTheme(<Card title="Dune" onPress={onPress} testID="card" />);
    fireEvent.press(screen.getByRole('button', { name: 'Dune' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('shows illustration, title, message and action', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <EmptyState
        testID="empty"
        illustration={<RNText>art</RNText>}
        title="Nothing here yet"
        message="Scan a book to begin."
        action={{ label: 'Scan', onPress, testID: 'empty-action' }}
      />,
    );
    expect(screen.getByText('art')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Nothing here yet' }).props['aria-level']).toBe(2);
    expect(screen.getByText('Scan a book to begin.')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('empty-action'));
    expect(onPress).toHaveBeenCalled();
  });

  it('can carry the screen h1', () => {
    renderWithTheme(<EmptyState title="Loans" headingLevel={1} titleTestID="title" />);
    expect(screen.getByTestId('title').props['aria-level']).toBe(1);
  });
});

describe('TextField', () => {
  function Controlled(props: { errorText?: string; helperText?: string }) {
    const [value, setValue] = useState('');
    return <TextField label="Title" value={value} onChangeText={setValue} testID="field" {...props} />;
  }

  it('is labelled and controlled', () => {
    renderWithTheme(<Controlled helperText="As printed on the cover" />);
    const input = screen.getByLabelText('Title');
    expect(input).toBe(screen.getByTestId('field'));
    fireEvent.changeText(input, 'Emma');
    expect(screen.getByTestId('field').props.value).toBe('Emma');
    expect(screen.getByText('As printed on the cover')).toBeOnTheScreen();
  });

  it('announces errors', () => {
    renderWithTheme(<Controlled errorText="Title is required" helperText="ignored" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
    expect(screen.queryByText('ignored')).toBeNull();
    expect(screen.getByTestId('field').props['aria-invalid']).toBe(true);
  });

  it('shows a focus border', () => {
    renderWithTheme(<Controlled />);
    fireEvent(screen.getByTestId('field'), 'focus');
    expect(screen.getByTestId('field')).toHaveStyle({ borderColor: lightTheme.colors.primary, borderWidth: 2 });
    fireEvent(screen.getByTestId('field'), 'blur');
    expect(screen.getByTestId('field')).toHaveStyle({ borderColor: lightTheme.colors.outline });
  });
});
