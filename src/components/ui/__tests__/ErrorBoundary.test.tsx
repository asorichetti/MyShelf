import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ErrorBoundary, type ErrorFallbackProps } from '@/components/ui';

let mockBroken = true;
function Fragile({ label = 'fine' }: { label?: string }) {
  if (mockBroken) throw new Error('the shelf fell over');
  return <Text>{label}</Text>;
}

function Fallback({ error, retry, componentStack }: ErrorFallbackProps) {
  return (
    <Pressable role="button" accessibilityLabel="Try again" onPress={retry}>
      <Text>{`caught: ${error.message}`}</Text>
      <Text testID="stack">{componentStack ?? ''}</Text>
    </Pressable>
  );
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  mockBroken = true;
  // React reports every caught render error on the console; these are on purpose.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('ErrorBoundary (P09-04)', () => {
  it('shows the fallback instead of children that throw, and tells onError', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary fallback={(p) => <Fallback {...p} />} onError={onError}>
        <Fragile />
      </ErrorBoundary>,
    );
    expect(screen.getByText('caught: the shelf fell over')).toBeOnTheScreen();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(screen.getByTestId('stack').props.children).toMatch(/ErrorBoundary.test/);
  });

  it('renders the children again on retry, and calls onRetry', () => {
    const onRetry = jest.fn();
    render(
      <ErrorBoundary fallback={(p) => <Fallback {...p} />} onRetry={onRetry}>
        <Fragile label="back on the shelf" />
      </ErrorBoundary>,
    );
    mockBroken = false;
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('back on the shelf')).toBeOnTheScreen();
  });

  it('shows the fallback again when the retry fails too', () => {
    render(
      <ErrorBoundary fallback={(p) => <Fallback {...p} />}>
        <Fragile />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('caught: the shelf fell over')).toBeOnTheScreen();
  });

  it('turns a thrown non-Error into an Error', () => {
    function ThrowsString(): null {
      throw 'just a string';
    }
    render(
      <ErrorBoundary fallback={(p) => <Fallback {...p} />}>
        <ThrowsString />
      </ErrorBoundary>,
    );
    expect(screen.getByText('caught: just a string')).toBeOnTheScreen();
  });

  it('leaves siblings outside the boundary alone', () => {
    render(
      <>
        <Text>tab bar</Text>
        <ErrorBoundary fallback={(p) => <Fallback {...p} />}>
          <Fragile />
        </ErrorBoundary>
      </>,
    );
    expect(screen.getByText('tab bar')).toBeOnTheScreen();
  });
});
