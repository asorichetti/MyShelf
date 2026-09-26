import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { GenresInput } from '@/components/book/GenresInput';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

let latest: string[] = [];

function Harness({ initial = [], existing = [] }: { initial?: string[]; existing?: string[] }) {
  const [genres, setGenres] = useState(initial);
  const [text, setText] = useState('');
  const onChange = (next: string[]) => {
    latest = next;
    setGenres(next);
  };
  return <GenresInput genres={genres} onChange={onChange} text={text} onTextChange={setText} existing={existing} />;
}

describe('GenresInput', () => {
  it('offers the library’s genres and the starter list when empty', () => {
    renderWithTheme(<Harness existing={['Cosy Crime']} />);
    const suggestions = screen.getAllByTestId(Testids.bookForm.genreSuggestion).map((c) => c.props.accessibilityLabel);
    expect(suggestions.slice(0, 3)).toEqual(['Add genre Cosy Crime', 'Add genre Fiction', 'Add genre Fantasy']);
  });

  it('adds a suggestion and stops suggesting it', () => {
    renderWithTheme(<Harness />);
    fireEvent.press(screen.getByRole('button', { name: 'Add genre Fantasy' }));
    expect(latest).toEqual(['Fantasy']);
    expect(screen.getAllByTestId(Testids.bookForm.genreChip)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add genre Fantasy' })).toBeNull();
  });

  it('filters suggestions as you type and adds typed genres, de-duplicated ignoring case', () => {
    renderWithTheme(<Harness initial={['Fantasy']} existing={['Science Fiction']} />);
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.genreInput), 'fic');
    expect(screen.getAllByTestId(Testids.bookForm.genreSuggestion)[0].props.accessibilityLabel).toBe('Add genre Science Fiction');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.genreInput), 'fantasy');
    fireEvent(screen.getByTestId(Testids.bookForm.genreInput), 'submitEditing');
    expect(latest).toEqual(['Fantasy']);
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.genreInput), 'science fiction');
    fireEvent.press(screen.getByTestId(Testids.bookForm.genreAdd));
    expect(latest).toEqual(['Fantasy', 'Science Fiction']);
  });

  it('removes a chosen genre', () => {
    renderWithTheme(<Harness initial={['Fantasy', 'Humour']} />);
    fireEvent.press(screen.getByRole('button', { name: 'Remove genre Fantasy' }));
    expect(latest).toEqual(['Humour']);
  });
});
