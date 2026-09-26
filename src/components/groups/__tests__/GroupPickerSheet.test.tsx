import { fireEvent, screen } from '@testing-library/react-native';

import { GroupPickerSheet } from '@/components/groups/GroupPickerSheet';
import { hostsWithRole, renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const groups = [
  { id: 1, name: 'Favourites', colour: 'lavender', icon: 'heart', count: 3 },
  { id: 2, name: 'Signed', colour: 'berry', icon: 'pen', count: 1 },
];

describe('GroupPickerSheet', () => {
  it('offers each group as a named button and reports the pick', () => {
    const onPick = jest.fn();
    renderWithTheme(<GroupPickerSheet visible title="Add 3 books to a group" groups={groups} onPick={onPick} onNew={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getAllByTestId(Testids.groups.pickerOption)).toHaveLength(2);
    fireEvent.press(screen.getByRole('button', { name: 'Signed, 1 book' }));
    expect(onPick).toHaveBeenCalledWith(2);
  });

  it('is a labelled list whose items are the groups (P09-01)', () => {
    renderWithTheme(<GroupPickerSheet visible title="Add" groups={groups} onPick={jest.fn()} onNew={jest.fn()} onClose={jest.fn()} />);
    const list = screen.getByLabelText('Your groups');
    expect(list.props.role).toBe('list');
    const items = hostsWithRole(screen.UNSAFE_root, 'listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toContainElement(screen.getByRole('button', { name: 'Favourites, 3 books' }));
  });

  it('does not offer a group the book is already in', () => {
    const onPick = jest.fn();
    renderWithTheme(<GroupPickerSheet visible title="Add" groups={groups} disabledIds={new Set([1])} onPick={onPick} onNew={jest.fn()} onClose={jest.fn()} />);
    const already = screen.getByRole('button', { name: 'Favourites, already added' });
    expect(already).toBeDisabled();
    fireEvent.press(already);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('starts a new group, and explains when there are none', () => {
    const onNew = jest.fn();
    renderWithTheme(<GroupPickerSheet visible title="Add" groups={[]} onPick={jest.fn()} onNew={onNew} onClose={jest.fn()} />);
    expect(screen.getByText(/You have no groups yet/)).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(Testids.groups.pickerNew));
    expect(onNew).toHaveBeenCalled();
  });
});
