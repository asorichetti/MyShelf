import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { SortSheet } from '@/components/book/SortSheet';
import type { SavedSortPreset, ShelfGroupBy, ShelfSort } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { levels } from '@/testing/sorts';
import { Testids } from '@/testing/testids.gen';

const T = Testids.sortSheet;

/** The sheet with real state, as the Shelf holds it. */
function Harness({ start, groupBy = 'none', saved = [], spy }: { start: ShelfSort; groupBy?: ShelfGroupBy; saved?: SavedSortPreset[]; spy: (s: ShelfSort, p: SavedSortPreset[]) => void }) {
  const [sort, setSort] = useState(start);
  const [presets, setPresets] = useState(saved);
  spy(sort, presets);
  return <SortSheet visible sort={sort} groupBy={groupBy} presets={presets} onChange={setSort} onPresetsChange={setPresets} onClose={() => {}} />;
}

function renderSheet(start: ShelfSort, extra: { groupBy?: ShelfGroupBy; saved?: SavedSortPreset[] } = {}) {
  const state: { sort: ShelfSort; presets: SavedSortPreset[] } = { sort: start, presets: extra.saved ?? [] };
  renderWithTheme(<Harness start={start} {...extra} spy={(s, p) => Object.assign(state, { sort: s, presets: p })} />);
  return state;
}

const levelNames = () => screen.getAllByTestId(T.level).map((el) => el.props['aria-label']);

describe('SortSheet', () => {
  it('applies a preset chip and shows the sort in words', () => {
    const state = renderSheet({ levels: levels(['title']) });
    fireEvent.press(screen.getByRole('radio', { name: 'Library order' }));
    expect(state.sort.levels.map((l) => l.key)).toEqual(['genre', 'author', 'series', 'seriesPosition']);
    expect(screen.getByText('Genre, then Author, then Series, then Number in series')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Library order' })).toBeChecked();
  });

  it('builds a three-level sort: add, choose keys, reverse, move and remove', () => {
    const state = renderSheet({ levels: levels(['title']) });
    // Level 1: Genre.
    fireEvent.press(screen.getByRole('button', { name: 'Sort by: Title. Change' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Genre' }));
    // Level 2: Year published, newest first.
    fireEvent.press(screen.getByTestId(T.addLevel));
    fireEvent.press(screen.getByRole('radio', { name: 'Year published' }));
    fireEvent.press(screen.getByRole('button', { name: 'Year published order: Oldest first. Reverse' }));
    // Level 3: Page count.
    fireEvent.press(screen.getByTestId(T.addLevel));
    fireEvent.press(screen.getByRole('radio', { name: 'Page count' }));
    expect(state.sort.levels).toEqual(levels(['genre'], ['year', 'desc'], ['pages']));
    expect(levelNames()).toEqual(['Level 1: Sort by Genre, A to Z', 'Level 2: Then by Year published, Newest first', 'Level 3: Then by Page count, Shortest first']);

    fireEvent.press(screen.getByRole('button', { name: 'Move Page count up' }));
    expect(state.sort.levels.map((l) => l.key)).toEqual(['genre', 'pages', 'year']);
    expect(screen.getByTestId(T.status)).toHaveTextContent('Page count moved to level 2 of 3');
    expect(screen.getByRole('button', { name: 'Move Genre up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Year published down' })).toBeDisabled();

    fireEvent.press(screen.getByRole('button', { name: 'Remove Genre' }));
    expect(state.sort.levels.map((l) => l.key)).toEqual(['pages', 'year']);
    expect(screen.getByTestId(T.status)).toHaveTextContent('Removed Genre');
  });

  it('offers only keys not already used, stops at four levels and never removes the last', () => {
    renderSheet({ levels: levels(['genre'], ['author'], ['series'], ['seriesPosition']) });
    expect(screen.getByTestId(T.addLevel)).toBeDisabled();
    fireEvent.press(screen.getByRole('button', { name: 'Then by: Author. Change' }));
    expect(screen.queryByRole('radio', { name: 'Genre' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Author' })).toBeChecked();
    screen.unmount();
    renderSheet({ levels: levels(['genre']) });
    expect(screen.getByRole('button', { name: 'Remove Genre' })).toBeDisabled();
  });

  it('saves the current sort as a named preset, refusing a taken name', () => {
    const state = renderSheet({ levels: levels(['pages', 'desc'], ['title']) });
    fireEvent.press(screen.getByTestId(T.savePreset));
    fireEvent.changeText(screen.getByTestId(T.presetName), 'Library order');
    fireEvent.press(screen.getByTestId(T.presetSave));
    expect(screen.getByText('You already have a preset with that name.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId(T.presetName), 'Doorstops');
    fireEvent.press(screen.getByTestId(T.presetSave));
    expect(state.presets).toEqual([{ id: expect.any(String), name: 'Doorstops', levels: levels(['pages', 'desc'], ['title']) }]);
    expect(screen.getByTestId(T.status)).toHaveTextContent('Saved “Doorstops”');
    // Already saved: nothing to save again.
    expect(screen.getByTestId(T.savePreset)).toBeDisabled();
  });

  it('applies, renames and deletes a saved preset', () => {
    const saved = [{ id: 'p1', name: 'Doorstops', levels: levels(['pages', 'desc']) }];
    const state = renderSheet({ levels: levels(['title']) }, { saved });
    fireEvent.press(screen.getByRole('button', { name: 'Doorstops: Page count (Longest first)' }));
    expect(state.sort.levels).toEqual(levels(['pages', 'desc']));
    fireEvent.press(screen.getByRole('button', { name: 'Rename Doorstops' }));
    fireEvent.changeText(screen.getByTestId(T.renameField), 'Big books');
    fireEvent.press(screen.getByTestId(T.renameSave));
    expect(state.presets.map((p) => p.name)).toEqual(['Big books']);
    fireEvent.press(screen.getByRole('button', { name: 'Delete Big books' }));
    expect(state.presets).toEqual([]);
  });

  it('Surprise me can be shuffled again, with a new seed', () => {
    const state = renderSheet({ levels: levels(['title']) });
    fireEvent.press(screen.getByRole('radio', { name: 'Surprise me' }));
    const first = state.sort.seed;
    expect(first).toBeGreaterThan(0);
    expect(screen.queryByTestId(T.levelDirection)).toBeNull();
    fireEvent.press(screen.getByTestId(T.reshuffle));
    expect(state.sort.seed).not.toBe(first);
  });

  it('says when the first level is the grouping and so orders the sections', () => {
    renderSheet({ levels: levels(['genre'], ['author']) }, { groupBy: 'genre' });
    expect(screen.getByTestId(T.groupNote)).toHaveTextContent(/Grouped by genre: Genre orders the sections/);
    expect(screen.getByText('Genre (as sections), then Author')).toBeOnTheScreen();
  });
});
