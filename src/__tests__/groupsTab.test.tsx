import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { groupsRepo, type Db } from '@/db';
import { GroupDetailScreen } from '@/features/groups/GroupDetailScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

/** findBy* with the fake timers renderRouter installs: poll through waitFor, which advances them. */
const findRole = (role: string, options: { name: string | RegExp }) => waitFor(() => screen.getByRole(role, options));
const findTestId = (id: string) => waitFor(() => screen.getByTestId(id));
const findText = (text: string) => waitFor(() => screen.getByText(text));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const routes = { 'group/[id]': GroupDetailScreen, 'book/[id]': stubScreen('book') };
const cards = () => screen.getAllByTestId(Testids.groups.card).map((c) => c.props.accessibilityLabel as string);

describe('Groups tab', () => {
  it('shows Booky and a New group action when there are no groups', async () => {
    await loadFixture(db, 'empty');
    renderApp(db, '/groups', routes);
    expect(await findText('Groups are like little shelves — try “Favourites”.')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Booky the bookmark/)).toBeOnTheScreen();
    expect(screen.getAllByTestId(Testids.groups.new)).toHaveLength(1);
  });

  it('shows group cards with their counts', async () => {
    await loadFixture(db, 'demo');
    renderApp(db, '/groups', routes);
    await waitFor(() => expect(cards()).toEqual(['Holiday reads, 3 books']));
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
  });

  it('creates a group from the tab', async () => {
    await loadFixture(db, 'demo');
    renderApp(db, '/groups', routes);
    await waitFor(() => expect(cards()).toHaveLength(1));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.new)));
    fireEvent.changeText(screen.getByTestId(Testids.groups.editorName), 'Favourites');
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Heart icon' })));
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Rose' })));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.editorSave)));
    await waitFor(() => expect(cards()).toEqual(['Favourites, 0 books', 'Holiday reads, 3 books']));
    expect((await groupsRepo.listGroups(db))[0]).toMatchObject({ name: 'Favourites', colour: 'rose', icon: 'heart' });
  });

  it('opens, edits and deletes a group', async () => {
    await loadFixture(db, 'demo');
    const r = renderApp(db, '/groups', routes);
    const target = await findRole('button', { name: 'Holiday reads, 3 books' });
    await act(async () => fireEvent.press(target));
    const [group] = await groupsRepo.listGroups(db);
    expect(r.getPathname()).toBe(`/group/${group.id}`);
    expect(await findTestId(Testids.groups.detailTitle)).toHaveTextContent('Holiday reads');
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(3));

    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.edit)));
    fireEvent.changeText(screen.getByTestId(Testids.groups.editorName), 'Beach reads');
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.editorSave)));
    await waitFor(() => expect(screen.getByTestId(Testids.groups.detailTitle)).toHaveTextContent('Beach reads'));

    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.delete)));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.dialog.confirm)));
    await waitFor(() => expect(r.getPathname()).toBe('/groups'));
    expect(await groupsRepo.listGroups(db)).toEqual([]);
  });

  it('reorders with move buttons and takes selected books out', async () => {
    await loadFixture(db, 'demo');
    const [group] = await groupsRepo.listGroups(db);
    renderApp(db, `/group/${group.id}`, routes);
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(3));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.reorder)));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Move Pride and Prejudice up' })));
    await waitFor(async () => expect((await groupsRepo.listGroupBookIds(db, group.id)).length).toBe(3));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.groups.reorderDone)));
    await waitFor(() =>
      expect(screen.getAllByTestId(Testids.home.row).map((r) => r.props.accessibilityLabel.split(',')[0])).toEqual([
        'Good Omens',
        'Pride and Prejudice',
        'Murder on the Orient Express',
      ]),
    );

    await act(async () => fireEvent(screen.getByRole('button', { name: /^Good Omens/ }), 'longPress'));
    await act(async () => fireEvent.press(screen.getByTestId(Testids.selection.remove)));
    await waitFor(() => expect(screen.getAllByTestId(Testids.home.row)).toHaveLength(2));
  });
});
