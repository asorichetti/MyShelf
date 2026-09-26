import { fireEvent, screen } from '@testing-library/react-native';

import { DatabaseErrorScreen } from '@/features/navigation/DatabaseErrorScreen';
import { LoadingScreen } from '@/features/navigation/LoadingScreen';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const h1s = () => screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1);

describe('DatabaseErrorScreen', () => {
  it('shows one h1, the page-error marker and a retry button', () => {
    const onRetry = jest.fn();
    renderWithTheme(<DatabaseErrorScreen error={new Error('boom')} onRetry={onRetry} />);
    expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.pageState.content)).toBeNull();
    expect(h1s()).toHaveLength(1);
    expect(screen.getByText('boom')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(Testids.dbError.retry));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('LoadingScreen', () => {
  it('shows only the page-loading marker, one h1 and a thinking Booky', () => {
    renderWithTheme(<LoadingScreen />);
    expect(screen.getByTestId(Testids.pageState.loading)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.pageState.content)).toBeNull();
    expect(h1s()).toHaveLength(1);
    expect(screen.getByLabelText('Booky the bookmark, thinking')).toBeOnTheScreen();
  });
});
