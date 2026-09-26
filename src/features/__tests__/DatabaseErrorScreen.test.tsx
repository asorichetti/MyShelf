import { fireEvent, screen } from '@testing-library/react-native';

import { DatabaseErrorScreen } from '@/features/navigation/DatabaseErrorScreen';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

it('shows one h1, the page-error marker and a retry button', () => {
  const onRetry = jest.fn();
  renderWithTheme(<DatabaseErrorScreen error={new Error('boom')} onRetry={onRetry} />);
  expect(screen.getByTestId(Testids.pageState.error)).toBeOnTheScreen();
  expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
  expect(screen.getByText('boom')).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId(Testids.dbError.retry));
  expect(onRetry).toHaveBeenCalled();
});
