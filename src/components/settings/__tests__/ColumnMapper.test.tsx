import { act, fireEvent, screen } from '@testing-library/react-native';

import { ColumnMapper } from '@/components/settings/ColumnMapper';
import type { ImportField } from '@/services/backup';
import { renderWithTheme } from '@/testing/render';

const headers = ['Title', 'Author', 'ISBN', 'Rating'];
const sample = ['Dune', 'Frank Herbert', '="9780441172719"', '5'];

function renderMapper(mapping: ImportField[], onChange = jest.fn()) {
  renderWithTheme(<ColumnMapper headers={headers} mapping={mapping} sample={sample} onChange={onChange} fieldTestID="field" />);
  return onChange;
}

describe('ColumnMapper', () => {
  it('lists the used columns with an example, and folds away the rest', async () => {
    renderMapper(['title', 'authors', 'isbn', 'ignore']);
    expect(screen.getAllByTestId('field').map((f) => f.props.accessibilityLabel)).toEqual([
      'Column “Title”: Title',
      'Column “Author”: Author(s)',
      'Column “ISBN”: ISBN (10 or 13)',
    ]);
    expect(screen.getByText('For example: 9780441172719')).toBeOnTheScreen();
    const toggle = screen.getByRole('button', { name: 'Show the 1 column not imported' });
    expect(toggle.props.accessibilityState.expanded).toBeFalsy();
    await act(async () => fireEvent.press(toggle));
    expect(screen.getAllByTestId('field')).toHaveLength(4);
  });

  it('moves a field to the column it was chosen for: one column per field', async () => {
    const onChange = renderMapper(['title', 'authors', 'isbn', 'ignore']);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Column “Author”: Author(s)' })));
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Title' })));
    expect(onChange).toHaveBeenLastCalledWith(['ignore', 'title', 'isbn', 'ignore']);
  });

  it('can turn a column off', async () => {
    const onChange = renderMapper(['title', 'authors', 'isbn', 'ignore']);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Column “ISBN”: ISBN (10 or 13)' })));
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Don’t import' })));
    expect(onChange).toHaveBeenLastCalledWith(['title', 'authors', 'ignore', 'ignore']);
  });
});
