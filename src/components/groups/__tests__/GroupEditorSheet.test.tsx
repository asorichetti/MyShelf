import { act, fireEvent, screen } from '@testing-library/react-native';

import { GroupEditorSheet } from '@/components/groups/GroupEditorSheet';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

describe('GroupEditorSheet', () => {
  it('names every swatch and icon for screen readers', () => {
    renderWithTheme(<GroupEditorSheet visible onSave={jest.fn()} onCancel={jest.fn()} />);
    const swatches = screen.getAllByTestId(Testids.groups.editorSwatch);
    const icons = screen.getAllByTestId(Testids.groups.editorIcon);
    expect(swatches).toHaveLength(8);
    expect(icons).toHaveLength(8);
    expect(swatches.map((s) => s.props.accessibilityLabel)).toEqual(['Lavender', 'Rose', 'Sage', 'Honey', 'Sky', 'Plum', 'Berry', 'Moss']);
    expect(icons.map((s) => s.props.accessibilityLabel)).toEqual(['Heart icon', 'Star icon', 'Bookmark icon', 'Gift icon', 'Moon icon', 'Sun icon', 'Pen icon', 'Home icon']);
    expect(screen.getByRole('radio', { name: 'Lavender' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Bookmark icon' })).toBeChecked();
  });

  it('saves the name, colour and icon chosen', async () => {
    const onSave = jest.fn();
    renderWithTheme(<GroupEditorSheet visible onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId(Testids.groups.editorName), '  Favourites ');
    fireEvent.press(screen.getByRole('radio', { name: 'Sage' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Heart icon' }));
    expect(screen.getByRole('radio', { name: 'Heart icon' })).toBeChecked();
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.editorSave)));
    expect(onSave).toHaveBeenCalledWith({ name: 'Favourites', colour: 'sage', icon: 'heart' });
  });

  it('asks for a name instead of saving a blank one', async () => {
    const onSave = jest.fn();
    renderWithTheme(<GroupEditorSheet visible onSave={onSave} onCancel={jest.fn()} />);
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.editorSave)));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Give the group a name.');
  });

  it('starts from the group being edited', () => {
    renderWithTheme(<GroupEditorSheet visible initial={{ name: 'Signed', colour: 'berry', icon: 'pen' }} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId(Testids.groups.editorName).props.value).toBe('Signed');
    expect(screen.getByRole('radio', { name: 'Berry' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Pen icon' })).toBeChecked();
    expect(screen.getByText('Edit group')).toBeOnTheScreen();
  });

  it('keeps the sheet open with a message when saving fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    renderWithTheme(<GroupEditorSheet visible onSave={() => Promise.reject(new Error('disk full'))} onCancel={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId(Testids.groups.editorName), 'Kids');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.editorSave)));
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t save/);
  });

  it('renders nothing while closed', () => {
    renderWithTheme(<GroupEditorSheet visible={false} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByTestId(Testids.groups.editorSheet)).toBeNull();
  });
});
