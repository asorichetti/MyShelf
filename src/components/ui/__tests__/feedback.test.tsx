import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text as RNText } from 'react-native';

import {
  ConfirmDialog,
  SNACKBAR_ACTION_DURATION,
  SNACKBAR_DURATION,
  Snackbar,
  SnackbarHost,
  SnackbarProvider,
  useSnackbar,
  type SnackbarOptions,
} from '@/components/ui';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';
import { lightTheme } from '@/theme';

describe('ConfirmDialog', () => {
  const base = { title: 'Remove this book?', message: 'Loan history for it will be removed too.' };

  it('renders nothing while hidden', () => {
    renderWithTheme(<ConfirmDialog {...base} visible={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByTestId(Testids.dialog.root)).toBeNull();
  });

  it('is a labelled modal alert dialog with title and message', () => {
    renderWithTheme(<ConfirmDialog {...base} visible onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByTestId(Testids.dialog.root);
    expect(dialog.props.role).toBe('alertdialog');
    expect(dialog.props['aria-modal']).toBe(true);
    const title = screen.getByRole('heading', { name: base.title });
    expect(dialog.props['aria-labelledby']).toBe(title.props.nativeID);
    expect(screen.getByText(base.message).props.nativeID).toBe(dialog.props['aria-describedby']);
  });

  it('confirms and cancels', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderWithTheme(<ConfirmDialog {...base} visible confirmLabel="Remove" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId(Testids.dialog.cancel));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('puts Cancel first so it is the default focus', () => {
    renderWithTheme(<ConfirmDialog {...base} visible onConfirm={() => {}} onCancel={() => {}} />);
    const buttons = screen.getAllByRole('button').filter((b) => b.props.testID?.startsWith('dialog-'));
    expect(buttons.map((b) => b.props.testID)).toEqual([Testids.dialog.cancel, Testids.dialog.confirm]);
  });

  it('uses the danger button for destructive confirmations', () => {
    renderWithTheme(<ConfirmDialog {...base} visible destructive onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByTestId(Testids.dialog.confirm)).toHaveStyle({ backgroundColor: lightTheme.colors.danger });
  });

  it('disables both buttons while busy', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    renderWithTheme(<ConfirmDialog {...base} visible busy onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.press(screen.getByTestId(Testids.dialog.confirm));
    fireEvent.press(screen.getByTestId(Testids.dialog.cancel));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('shows an illustration and extra content', () => {
    renderWithTheme(
      <ConfirmDialog {...base} visible illustration={<RNText>booky</RNText>} onConfirm={() => {}} onCancel={() => {}}>
        <RNText>It is on loan to Sam.</RNText>
      </ConfirmDialog>,
    );
    expect(screen.getByText('booky')).toBeOnTheScreen();
    expect(screen.getByText('It is on loan to Sam.')).toBeOnTheScreen();
  });
});

describe('Snackbar', () => {
  it('is a polite status message with an optional action', () => {
    const onPress = jest.fn();
    renderWithTheme(<Snackbar message="Removed “Dune”" action={{ label: 'Undo', onPress }} />);
    const bar = screen.getByTestId(Testids.snackbar.root);
    expect(bar.props.role).toBe('status');
    expect(bar.props['aria-live']).toBe('polite');
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('has no action button without an action', () => {
    renderWithTheme(<Snackbar message="Saved" />);
    expect(screen.queryByTestId(Testids.snackbar.action)).toBeNull();
  });
});

describe('SnackbarProvider and SnackbarHost', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function Trigger({ options }: { options: SnackbarOptions }) {
    const { show } = useSnackbar();
    return (
      <Pressable role="button" accessibilityLabel="show" onPress={() => show(options)}>
        <RNText>show</RNText>
      </Pressable>
    );
  }

  function renderHost(options: SnackbarOptions) {
    return renderWithTheme(
      <SnackbarProvider>
        <Trigger options={options} />
        <SnackbarHost />
      </SnackbarProvider>,
    );
  }

  it('shows a message and hides it after the default timeout', () => {
    renderHost({ message: 'Saved' });
    expect(screen.queryByTestId(Testids.snackbar.root)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    expect(screen.getByText('Saved')).toBeOnTheScreen();
    act(() => jest.advanceTimersByTime(SNACKBAR_DURATION - 1));
    expect(screen.getByText('Saved')).toBeOnTheScreen();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByTestId(Testids.snackbar.root)).toBeNull();
  });

  it('is one live region that is there before the message, so each message is read out (P09-01)', () => {
    renderHost({ message: 'Lent to Sam' });
    const regions = () => screen.UNSAFE_root.findAll((n) => typeof n.type === 'string' && n.props.role === 'status');
    expect(regions()).toHaveLength(1);
    expect(regions()[0]!.props['aria-live']).toBe('polite');
    expect(regions()[0]!.props.accessibilityLiveRegion).toBe('polite');
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    // Still one region: the bar inside is not a second one.
    expect(regions()).toHaveLength(1);
    expect(regions()[0]).toContainElement(screen.getByText('Lent to Sam'));
    expect(screen.getByTestId(Testids.snackbar.root).props.role).toBeUndefined();
  });

  it('keeps an action snackbar longer, and the action runs once and closes it', () => {
    const onUndo = jest.fn();
    renderHost({ message: 'Removed', action: { label: 'Undo', onPress: onUndo } });
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    act(() => jest.advanceTimersByTime(SNACKBAR_DURATION));
    expect(screen.getByTestId(Testids.snackbar.action)).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(Testids.snackbar.action));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(Testids.snackbar.root)).toBeNull();
  });

  it('times out an action snackbar after its longer duration', () => {
    renderHost({ message: 'Removed', action: { label: 'Undo', onPress: () => {} } });
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    act(() => jest.advanceTimersByTime(SNACKBAR_ACTION_DURATION));
    expect(screen.queryByTestId(Testids.snackbar.root)).toBeNull();
  });

  it('pauses the timer while the action has focus', () => {
    renderHost({ message: 'Removed', action: { label: 'Undo', onPress: () => {} } });
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    fireEvent(screen.getByTestId(Testids.snackbar.action), 'focus');
    act(() => jest.advanceTimersByTime(SNACKBAR_ACTION_DURATION * 2));
    expect(screen.getByTestId(Testids.snackbar.root)).toBeOnTheScreen();
    fireEvent(screen.getByTestId(Testids.snackbar.action), 'blur');
    act(() => jest.advanceTimersByTime(SNACKBAR_ACTION_DURATION));
    expect(screen.queryByTestId(Testids.snackbar.root)).toBeNull();
  });

  it('tells the owner why it went away, once', () => {
    const onHide = jest.fn();
    const { rerender } = renderHost({ message: 'Removed', action: { label: 'Undo', onPress: () => {} }, onHide });
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    fireEvent.press(screen.getByTestId(Testids.snackbar.action));
    expect(onHide).toHaveBeenCalledWith('action');
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    act(() => jest.advanceTimersByTime(SNACKBAR_ACTION_DURATION));
    expect(onHide).toHaveBeenLastCalledWith('timeout');
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    rerender(<></>);
    expect(onHide).toHaveBeenCalledTimes(2);
  });

  it('reports a snackbar replaced by another', () => {
    const onHide = jest.fn();
    renderHost({ message: 'First', onHide });
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    fireEvent.press(screen.getByRole('button', { name: 'show' }));
    expect(onHide).toHaveBeenCalledWith('replaced');
  });

  it('throws a helpful error outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger options={{ message: 'x' }} />)).toThrow(/SnackbarProvider/);
    spy.mockRestore();
  });
});
