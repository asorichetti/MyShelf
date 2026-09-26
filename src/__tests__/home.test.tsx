import { render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';
import { Testids } from '@/testing/testids.gen';

describe('HomeScreen', () => {
  it('renders the app title inside the page content marker', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId(Testids.pageState.content)).toBeTruthy();
    expect(screen.getByTestId(Testids.home.title)).toHaveTextContent('MyShelf');
  });
});
