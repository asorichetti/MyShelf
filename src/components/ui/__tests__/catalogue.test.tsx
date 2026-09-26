import { fireEvent, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';

import { CatalogueCard, Chip, IconButton, Stamp, type StampTone } from '@/components/ui';
import { renderWithTheme } from '@/testing/render';
import { contrastRatio, lightTheme, textPairs } from '@/theme';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('IconButton', () => {
  it('is a button named by its required label, with a 48 dp target', () => {
    const onPress = jest.fn();
    renderWithTheme(<IconButton icon="pencil" accessibilityLabel="Edit book" onPress={onPress} testID="ib" />);
    const button = screen.getByRole('button', { name: 'Edit book' });
    expect(flat(button.props.style)).toMatchObject({ width: 48, height: 48 });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and says so', () => {
    const onPress = jest.fn();
    renderWithTheme(<IconButton icon="delete" accessibilityLabel="Delete" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Delete' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('exposes the expanded state of a disclosure', () => {
    renderWithTheme(<IconButton icon="dots-vertical" accessibilityLabel="More actions" expanded={false} />);
    expect(screen.getByRole('button', { name: 'More actions' })).toBeCollapsed();
  });

  it.each(['plain', 'tonal', 'filled', 'danger'] as const)('renders the %s variant', (variant) => {
    renderWithTheme(<IconButton icon="plus" accessibilityLabel="Add" variant={variant} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeOnTheScreen();
  });
});

describe('CatalogueCard', () => {
  it('shows the title in Lora and the author and ISBN in Courier Prime', () => {
    renderWithTheme(
      <CatalogueCard
        title="Mort"
        authors="Terry Pratchett"
        isbn="9780552131063"
        callNumber="FIC PRA 1987"
        titleTestID="t"
        authorsTestID="a"
        callNumberTestID="c"
      />,
    );
    expect(screen.getByTestId('t')).toHaveStyle({ fontFamily: lightTheme.typography.h3.fontFamily });
    expect(screen.getByTestId('a')).toHaveStyle({ fontFamily: lightTheme.fonts.mono });
    expect(screen.getByText('ISBN 9780552131063')).toHaveStyle({ fontFamily: lightTheme.fonts.mono });
    expect(screen.getByTestId('c')).toHaveTextContent('FIC PRA 1987');
  });

  it('can render its title as a heading', () => {
    renderWithTheme(<CatalogueCard title="Dune" titleLevel={1} size="header" />);
    expect(screen.getByRole('heading', { name: 'Dune' }).props['aria-level']).toBe(1);
  });

  it('becomes one button with the given accessible name when pressable', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <CatalogueCard title="Mort" authors="Terry Pratchett" onPress={onPress} accessibilityLabel="Mort, by Terry Pratchett, 1987" />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Mort, by Terry Pratchett, 1987' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders the cover, aside and child slots and hides empty lines', () => {
    renderWithTheme(
      <CatalogueCard title="Untitled" subtitle={null} authors={null} isbn={null} cover={<RNText>cover</RNText>} aside={<RNText>aside</RNText>}>
        <RNText>child</RNText>
      </CatalogueCard>,
    );
    expect(screen.getByText('cover')).toBeOnTheScreen();
    expect(screen.getByText('aside')).toBeOnTheScreen();
    expect(screen.getByText('child')).toBeOnTheScreen();
    expect(screen.queryByText(/ISBN/)).toBeNull();
  });
});

describe('Chip', () => {
  it('is plain text when not interactive', () => {
    renderWithTheme(<Chip label="Fantasy" />);
    expect(screen.getByText('Fantasy')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('toggles as a pressed button and shows a check when selected', () => {
    const onPress = jest.fn();
    const { rerender } = renderWithTheme(<Chip label="Title" onPress={onPress} selected={false} />);
    const chip = screen.getByRole('button', { name: 'Title' });
    expect(chip.props['aria-pressed']).toBe(false);
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
    rerender(<Chip label="Title" onPress={onPress} selected />);
    expect(screen.getByRole('button', { name: 'Title' }).props['aria-pressed']).toBe(true);
    expect(screen.getByText('icon:check', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('uses radio semantics for one-of-many choices', () => {
    renderWithTheme(<Chip label="Year" role="radio" onPress={() => {}} selected />);
    const chip = screen.getByRole('radio', { name: 'Year' });
    expect(chip).toBeChecked();
  });

  it('has a labelled remove button with at least a 44 x 48 target', () => {
    const onRemove = jest.fn();
    renderWithTheme(<Chip label="Terry Pratchett" onRemove={onRemove} removeTestID="rm" />);
    const remove = screen.getByRole('button', { name: 'Remove Terry Pratchett' });
    expect(flat(remove.props.style)).toMatchObject({ width: 44, height: 48 });
    fireEvent.press(remove);
    expect(onRemove).toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    renderWithTheme(<Chip label="Author" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button', { name: 'Author' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Stamp', () => {
  const tones: StampTone[] = ['warn', 'danger', 'success', 'accent'];

  it.each(tones)('%s stamp inks its text in the tone on card stock, a pair that meets AA', (tone) => {
    renderWithTheme(<Stamp label="Overdue" tone={tone} testID="stamp" />);
    expect(screen.getByText('Overdue')).toHaveStyle({ color: lightTheme.colors[tone], textTransform: 'uppercase' });
    expect(screen.getByTestId('stamp')).toHaveStyle({ backgroundColor: lightTheme.colors.surface });
    expect(textPairs).toContainEqual([tone, 'surface']);
    expect(contrastRatio(lightTheme.colors[tone], lightTheme.colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('is tilted and uses the stamp type style', () => {
    renderWithTheme(<Stamp label="On loan" testID="stamp" rotate={-3} />);
    expect(screen.getByTestId('stamp')).toHaveStyle({ transform: [{ rotate: '-3deg' }] });
    expect(screen.getByText('On loan')).toHaveStyle({ fontFamily: lightTheme.typography.stamp.fontFamily });
  });

  it('can carry a fuller description for screen readers', () => {
    renderWithTheme(<Stamp label="Due 12 Oct" accessibilityLabel="Due back on 12 October" />);
    expect(screen.getByLabelText('Due back on 12 October')).toBeOnTheScreen();
  });
});
