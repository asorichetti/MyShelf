import { act, fireEvent, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { DRAG_HOLD_MS, dragTestId, dropIndex, ReorderList } from '@/components/groups/ReorderList';
import type { BookListItem } from '@/domain';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

const item = (id: number, title: string): BookListItem => ({
  id,
  title,
  subtitle: null,
  authors: [],
  coverUri: null,
  publicationYear: null,
  seriesName: null,
  seriesPosition: null,
  onLoan: false,
});
const items = [item(1, 'Good Omens'), item(2, 'Mort'), item(3, 'Dune')];

async function renderList(onMove: jest.Mock) {
  renderWithTheme(<ReorderList items={items} onMove={onMove} />);
  // Let the reduce-motion answer arrive.
  await act(async () => {});
}

describe('ReorderList', () => {
  it('has move up and move down buttons named after each book', async () => {
    await renderList(jest.fn());
    expect(screen.getAllByTestId(Testids.groups.moveUp)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Move Mort up' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Move Mort down' })).toBeOnTheScreen();
  });

  it('disables moving past either end', async () => {
    await renderList(jest.fn());
    expect(screen.getByRole('button', { name: 'Move Good Omens up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Dune down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Dune up' })).toBeEnabled();
  });

  it('moves a book and announces where it went', async () => {
    const onMove = jest.fn();
    await renderList(onMove);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Move Dune up' })));
    expect(onMove).toHaveBeenCalledWith(2, 1);
    expect(screen.getByText('Dune moved to 2 of 3')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Move Good Omens down' })));
    expect(onMove).toHaveBeenLastCalledWith(0, 1);
  });

  it('numbers the rows for screen readers', async () => {
    await renderList(jest.fn());
    expect(screen.getAllByTestId(Testids.groups.reorderRow).map((r) => r.props['aria-label'])).toEqual(['1. Good Omens', '2. Mort', '3. Dune']);
  });

  describe('drag to reorder', () => {
    // Rows 80 dp tall with an 8 dp gap: tops at 0, 88 and 176.
    const boxes = [
      { top: 0, height: 80 },
      { top: 88, height: 80 },
      { top: 176, height: 80 },
    ];

    it("works out where a dragged row lands from the other rows' middles", async () => {
      expect(dropIndex(boxes, 0, 0)).toBe(0);
      expect(dropIndex(boxes, 0, 30)).toBe(0);
      expect(dropIndex(boxes, 0, 60)).toBe(0);
      expect(dropIndex(boxes, 0, 90)).toBe(1);
      expect(dropIndex(boxes, 0, 200)).toBe(2);
      expect(dropIndex(boxes, 2, -100)).toBe(1);
      expect(dropIndex(boxes, 2, -500)).toBe(0);
      expect(dropIndex(boxes, 1, 0)).toBe(1);
      // Before layout nothing moves.
      expect(dropIndex([], 1, 300)).toBe(1);
    });

    const layOut = () =>
      screen.getAllByTestId(Testids.groups.reorderRow).forEach((row, i) =>
        fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, ...boxes[i], y: boxes[i]!.top, width: 360 } } }),
      );
    const dragRow = (index: number, translationY: number, end: State = State.END) =>
      // The drop reaches React through a microtask (scheduleOnRN), which the async act waits for.
      act(async () =>
        fireGestureHandler(getByGestureTestId(dragTestId(index)), [
          { state: State.BEGAN, translationY: 0 },
          { state: State.ACTIVE, translationY: 0 },
          { translationY: translationY / 2 },
          { translationY },
          { state: end, translationY },
        ]),
      );

    it('moves a held and dragged book and announces where it went', async () => {
      const onMove = jest.fn();
      await renderList(onMove);
      layOut();
      await dragRow(2, -180);
      expect(onMove).toHaveBeenCalledWith(2, 0);
      expect(screen.getByText('Dune moved to 1 of 3')).toBeOnTheScreen();
    });

    it('moves nothing when a book is dropped where it was', async () => {
      const onMove = jest.fn();
      await renderList(onMove);
      layOut();
      await dragRow(1, 20);
      expect(onMove).not.toHaveBeenCalled();
      expect(screen.getByText('Hold a book and drag it to its place, or use the arrows.')).toBeOnTheScreen();
    });

    it('puts the book back when the drag is cancelled', async () => {
      const onMove = jest.fn();
      await renderList(onMove);
      layOut();
      await dragRow(0, 200, State.CANCELLED);
      expect(onMove).not.toHaveBeenCalled();
    });

    it('waits for a long press before a drag starts', async () => {
      await renderList(jest.fn());
      const gesture = getByGestureTestId(dragTestId(0)) as unknown as { config: { activateAfterLongPress?: number } };
      expect(gesture.config.activateAfterLongPress).toBe(DRAG_HOLD_MS);
    });
  });
});
