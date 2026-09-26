import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { matchingSeries, SeriesInput, type SeriesInputProps, type SeriesOption } from '@/components/book/SeriesInput';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const existing: SeriesOption[] = [
  { id: 1, name: 'Discworld', bookCount: 3 },
  { id: 2, name: 'Earthsea', bookCount: 2 },
  { id: 3, name: 'The Expanse', bookCount: 1 },
];

/** The picker with its own state, as the form holds it. */
function Harness(props: Partial<SeriesInputProps> & { initialName?: string; initialPosition?: string; onValues?: (n: string, p: string) => void }) {
  const { initialName = '', initialPosition = '', onValues, ...rest } = props;
  const [name, setName] = useState(initialName);
  const [position, setPosition] = useState(initialPosition);
  return (
    <SeriesInput
      existing={existing}
      name={name}
      position={position}
      onNameChange={(n) => {
        setName(n);
        onValues?.(n, position);
      }}
      onPositionChange={(p) => {
        setPosition(p);
        onValues?.(name, p);
      }}
      {...rest}
    />
  );
}

const nameValue = () => screen.getByTestId(Testids.seriesInput.search).props.value;
const positionValue = () => screen.getByTestId(Testids.seriesInput.position).props.value;

describe('matchingSeries', () => {
  it('matches ignoring case, accents and a leading article, starts-with first', () => {
    expect(matchingSeries(existing, 'expanse').exact?.name).toBe('The Expanse');
    expect(matchingSeries(existing, 'sea').options.map((s) => s.name)).toEqual(['Earthsea']);
    expect(matchingSeries(existing, 'e').options.map((s) => s.name)).toEqual(['Earthsea', 'The Expanse']);
    expect(matchingSeries(existing, 'world').options.map((s) => s.name)).toEqual(['Discworld']);
    expect(matchingSeries(existing, '  ')).toEqual({ exact: null, options: [] });
  });
});

describe('SeriesInput', () => {
  it('searches existing series while typing and picks one', () => {
    renderWithTheme(<Harness />);
    expect(screen.queryByTestId(Testids.seriesInput.option)).toBeNull();
    fireEvent.changeText(screen.getByTestId(Testids.seriesInput.search), 'disc');
    const options = screen.getAllByTestId(Testids.seriesInput.option);
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveProp('accessibilityLabel', 'Discworld, 3 books in your library');
    fireEvent.press(options[0]);
    expect(nameValue()).toBe('Discworld');
    expect(screen.queryByTestId(Testids.seriesInput.option)).toBeNull();
    expect(screen.getByTestId(Testids.seriesInput.status)).toHaveTextContent(/In your library · 3 books$/);
  });

  it('creates a new series inline', () => {
    renderWithTheme(<Harness />);
    fireEvent.changeText(screen.getByTestId(Testids.seriesInput.search), 'Wheel of Time ');
    expect(screen.getByTestId(Testids.seriesInput.create)).toHaveProp('accessibilityLabel', 'Start a new series called Wheel of Time');
    fireEvent.press(screen.getByTestId(Testids.seriesInput.create));
    expect(nameValue()).toBe('Wheel of Time');
    expect(screen.queryByTestId(Testids.seriesInput.create)).toBeNull();
    expect(screen.getByTestId(Testids.seriesInput.status)).toHaveTextContent(/A new series: it’s added when you save\.$/);
  });

  it('closes the list on an exact match, however it is spelled', () => {
    renderWithTheme(<Harness />);
    fireEvent.changeText(screen.getByTestId(Testids.seriesInput.search), 'the discworld');
    expect(screen.queryByTestId(Testids.seriesInput.create)).toBeNull();
    expect(screen.getByTestId(Testids.seriesInput.status)).toHaveTextContent(/In your library/);
  });

  it.each([
    ['3', 'Saves as #3'],
    ['III', 'Saves as #3'],
    ['2.5', 'Saves as #2.5'],
    ['Book 4 of 9', 'Saves as #4'],
    ['abc', 'Use a number like 3, 2.5 or III'],
    ['', '3, 2.5 or III'],
  ])('reads the position %p as %p', (typed, helper) => {
    renderWithTheme(<Harness initialName="Discworld" initialPosition={typed} />);
    expect(screen.getByText(helper)).toBeOnTheScreen();
  });

  it('round-trips positions as the form shows them', () => {
    renderWithTheme(<Harness initialName="Discworld" initialPosition="2.5" />);
    expect(positionValue()).toBe('2.5');
    fireEvent.changeText(screen.getByTestId(Testids.seriesInput.position), '5');
    expect(positionValue()).toBe('5');
  });

  it('clears both fields with "Not part of a series"', () => {
    renderWithTheme(<Harness initialName="Discworld" initialPosition="5" />);
    fireEvent.press(screen.getByTestId(Testids.seriesInput.clear));
    expect(nameValue()).toBe('');
    expect(positionValue()).toBe('');
    expect(screen.queryByTestId(Testids.seriesInput.clear)).toBeNull();
  });

  it('shows no suggestion chip without a hint', () => {
    renderWithTheme(<Harness />);
    expect(screen.queryByTestId(Testids.seriesInput.suggestion)).toBeNull();
  });

  it('offers the suggestion as a chip and applies it with the library’s spelling', () => {
    renderWithTheme(<Harness suggestion={{ name: 'discworld', position: 5 }} />);
    const chip = screen.getByTestId(Testids.seriesInput.suggestion);
    expect(chip).toHaveTextContent(/Suggested: discworld #5$/);
    fireEvent.press(chip);
    expect(nameValue()).toBe('Discworld');
    expect(positionValue()).toBe('5');
    expect(screen.queryByTestId(Testids.seriesInput.suggestion)).toBeNull();
  });

  it('shows errors from the form', () => {
    renderWithTheme(<Harness initialPosition="7" nameError="Add the series name to go with its number." />);
    expect(screen.getByText('Add the series name to go with its number.')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.seriesInput.search)).toHaveProp('aria-invalid', true);
  });
});
