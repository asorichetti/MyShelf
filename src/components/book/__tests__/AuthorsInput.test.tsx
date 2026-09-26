import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { AuthorsInput } from '@/components/book/AuthorsInput';
import type { DraftAuthor } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

let latest: DraftAuthor[] = [];

function Harness({ initial = [], suggest = async () => [] }: { initial?: DraftAuthor[]; suggest?: (p: string) => Promise<string[]> }) {
  const [authors, setAuthors] = useState<DraftAuthor[]>(initial);
  const [text, setText] = useState('');
  const onChange = (next: DraftAuthor[]) => {
    latest = next;
    setAuthors(next);
  };
  return <AuthorsInput authors={authors} onChange={onChange} text={text} onTextChange={setText} suggest={suggest} />;
}

const a = (name: string): DraftAuthor => ({ name, role: 'author', sortName: null });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('AuthorsInput', () => {
  it('adds a typed name with Enter or the Add button, once', () => {
    renderWithTheme(<Harness />);
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.authorInput), 'Terry Pratchett');
    fireEvent(screen.getByTestId(Testids.bookForm.authorInput), 'submitEditing');
    expect(latest).toEqual([a('Terry Pratchett')]);
    expect(screen.getByTestId(Testids.bookForm.authorInput).props.value).toBe('');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.authorInput), 'terry pratchett');
    fireEvent.press(screen.getByRole('button', { name: 'Add terry pratchett as an author' }));
    expect(latest).toHaveLength(1);
    expect(screen.getAllByTestId(Testids.bookForm.authorChip)).toHaveLength(1);
  });

  it('suggests existing authors and reuses the chosen one', async () => {
    const suggest = jest.fn(async () => ['Terry Pratchett', 'Neil Gaiman']);
    renderWithTheme(<Harness initial={[a('Neil Gaiman')]} suggest={suggest} />);
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.authorInput), 'ter');
    await act(async () => jest.advanceTimersByTime(200));
    expect(suggest).toHaveBeenCalledWith('ter');
    // Already-credited names are not suggested again.
    expect(screen.getAllByTestId(Testids.bookForm.authorSuggestion)).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Add Terry Pratchett, already in your library' }));
    expect(latest.map((x) => x.name)).toEqual(['Neil Gaiman', 'Terry Pratchett']);
  });

  it('reorders with move up and move down, which are disabled at the ends', () => {
    renderWithTheme(<Harness initial={[a('A One'), a('B Two'), a('C Three')]} />);
    expect(screen.getByRole('button', { name: 'Move A One up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move C Three down' })).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Move C Three up' }));
    expect(latest.map((x) => x.name)).toEqual(['A One', 'C Three', 'B Two']);
    fireEvent.press(screen.getByRole('button', { name: 'Move A One down' }));
    expect(latest.map((x) => x.name)).toEqual(['C Three', 'A One', 'B Two']);
  });

  it('removes an author', () => {
    renderWithTheme(<Harness initial={[a('A One'), a('B Two')]} />);
    fireEvent.press(screen.getByRole('button', { name: 'Remove A One' }));
    expect(latest.map((x) => x.name)).toEqual(['B Two']);
  });

  it('sets the role and the filed-as name in the details', () => {
    renderWithTheme(<Harness initial={[a('Ursula K. Le Guin')]} />);
    expect(screen.getByText('Filed as Le Guin, Ursula K.')).toBeOnTheScreen();
    const details = screen.getByRole('button', { name: 'Details for Ursula K. Le Guin' });
    expect(details).toBeCollapsed();
    fireEvent.press(details);
    expect(screen.getByRole('button', { name: 'Details for Ursula K. Le Guin' })).toBeExpanded();
    fireEvent.press(screen.getByRole('radio', { name: 'Translator' }));
    expect(latest[0].role).toBe('translator');
    fireEvent.changeText(screen.getByLabelText('Filed as'), 'LeGuin, U.');
    expect(latest[0].sortName).toBe('LeGuin, U.');
    fireEvent.changeText(screen.getByLabelText('Filed as'), '');
    expect(latest[0].sortName).toBeNull();
  });
});
