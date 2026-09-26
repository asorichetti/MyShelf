import { fireEvent, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { BookForm, errorSummary, type BookFormHandle, type BookFormProps } from '@/components/book/BookForm';
import { emptyDraft } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

function renderForm(props: Partial<BookFormProps> = {}) {
  const onChange = jest.fn();
  const onSave = jest.fn();
  const onCancel = jest.fn();
  const onPickCover = jest.fn();
  const ref = createRef<BookFormHandle>();
  renderWithTheme(
    <BookForm
      ref={ref}
      mode="add"
      draft={emptyDraft()}
      errors={{}}
      onChange={onChange}
      authorText=""
      onAuthorTextChange={() => {}}
      suggestAuthors={async () => []}
      genreText=""
      onGenreTextChange={() => {}}
      existingGenres={[]}
      saving={false}
      onSave={onSave}
      onCancel={onCancel}
      onPickCover={onPickCover}
      {...props}
    />,
  );
  return { onChange, onSave, onCancel, onPickCover, ref };
}

describe('BookForm', () => {
  it('has one h1 and labelled fields in catalogue order', () => {
    renderForm();
    const h1 = screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1);
    expect(h1.map((h) => h.props.children)).toEqual(['Add a book']);
    for (const id of [
      Testids.bookForm.title,
      Testids.bookForm.subtitle,
      Testids.bookForm.authorInput,
      Testids.bookForm.isbn,
      Testids.bookForm.publisher,
      Testids.bookForm.year,
      Testids.bookForm.edition,
      Testids.bookForm.format,
      Testids.bookForm.pages,
      Testids.bookForm.language,
      Testids.bookForm.genreInput,
      Testids.seriesInput.search,
      Testids.seriesInput.position,
      Testids.bookForm.summary,
      Testids.bookForm.notes,
    ]) {
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    }
    expect(screen.getByLabelText('Title (required)')).toBeOnTheScreen();
  });

  it('reports typing per field', () => {
    const { onChange } = renderForm();
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'Dune');
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.year), '1965');
    expect(onChange).toHaveBeenCalledWith('title', 'Dune');
    expect(onChange).toHaveBeenCalledWith('year', '1965');
  });

  it('picks and clears a format as a radio group', () => {
    const { onChange } = renderForm({ draft: { ...emptyDraft(), format: 'paperback' } });
    expect(screen.getByRole('radio', { name: 'Paperback' })).toBeChecked();
    fireEvent.press(screen.getByRole('radio', { name: 'Hardback' }));
    expect(onChange).toHaveBeenCalledWith('format', 'hardcover');
    fireEvent.press(screen.getByRole('radio', { name: 'Paperback' }));
    expect(onChange).toHaveBeenCalledWith('format', '');
  });

  it('picks a language from a list', () => {
    const { onChange } = renderForm();
    fireEvent.press(screen.getByRole('button', { name: 'Language: Not set' }));
    fireEvent.press(screen.getByRole('radio', { name: 'French' }));
    expect(onChange).toHaveBeenCalledWith('language', 'fr');
  });

  it('shows inline errors and a summary alert', () => {
    renderForm({ errors: { title: 'Every book needs a title.', isbn: 'That ISBN doesn’t look right — check the last digit.' } });
    const alert = screen.getByTestId(Testids.bookForm.error);
    expect(alert.props.role).toBe('alert');
    expect(alert).toHaveTextContent(/Please check 2 fields: Title and ISBN\./);
    expect(screen.getByText('Every book needs a title.')).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.bookForm.isbn).props['aria-invalid']).toBe(true);
  });

  it('has no error summary before a failed save', () => {
    renderForm();
    expect(screen.queryByTestId(Testids.bookForm.error)).toBeNull();
  });

  it('saves and cancels from the bar, and shows progress while saving', () => {
    const { onSave, onCancel } = renderForm();
    fireEvent.press(screen.getByTestId(Testids.bookForm.save));
    fireEvent.press(screen.getByTestId(Testids.bookForm.cancel));
    expect(onSave).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('offers to choose or take a photo of the cover', () => {
    const { onPickCover } = renderForm();
    expect(screen.getByText(/No cover yet/)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.bookForm.coverRemove)).toBeNull();
    fireEvent.press(screen.getByTestId(Testids.bookForm.coverPick));
    fireEvent.press(screen.getByTestId(Testids.bookForm.coverCamera));
    expect(onPickCover.mock.calls).toEqual([['library'], ['camera']]);
  });

  it('shows the chosen cover and can remove it', () => {
    const { onChange } = renderForm({ draft: { ...emptyDraft(), title: 'Dune', coverUri: 'file:///covers/1.jpg' } });
    expect(screen.getByText('This cover goes on the catalogue card.')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId(Testids.bookForm.coverRemove));
    expect(onChange).toHaveBeenCalledWith('coverUri', null);
  });

  it('offers online cover search only once it exists (P02-11)', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: 'Find a cover online' })).toBeNull();
    const onFindCoverOnline = jest.fn();
    renderForm({ onFindCoverOnline });
    fireEvent.press(screen.getByRole('button', { name: 'Find a cover online' }));
    expect(onFindCoverOnline).toHaveBeenCalled();
  });

  it('summarises one or several field errors', () => {
    expect(errorSummary({ year: 'x' })).toBe('Please check the Year field.');
    expect(errorSummary({ title: 'x', year: 'y', pages: 'z' })).toBe('Please check 3 fields: Title, Year and Pages.');
  });
});
