import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { useSelection } from '@/features/shelf/useSelection';

describe('useSelection', () => {
  it('starts on a long press with that book picked, and toggles books', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selecting).toBe(false);
    act(() => result.current.start(7));
    expect(result.current.selecting).toBe(true);
    expect(result.current.ids).toEqual([7]);
    act(() => result.current.toggle(3));
    act(() => result.current.toggle(9));
    act(() => result.current.toggle(7));
    expect(result.current.ids).toEqual([3, 9]);
    expect(result.current.count).toBe(2);
    expect(result.current.isSelected(9)).toBe(true);
    expect(result.current.isSelected(7)).toBe(false);
  });

  it('starts empty from the Select button', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.start());
    expect(result.current).toMatchObject({ selecting: true, count: 0 });
  });

  it('exits on Android back instead of leaving the screen', () => {
    const listeners: (() => boolean)[] = [];
    const remove = jest.fn();
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean);
      return { remove };
    });
    const { result } = renderHook(() => useSelection());
    expect(listeners).toHaveLength(0);
    act(() => result.current.start(1));
    expect(listeners).toHaveLength(1);
    let handled = false;
    act(() => {
      handled = listeners[0]();
    });
    expect(handled).toBe(true);
    expect(result.current).toMatchObject({ selecting: false, count: 0 });
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('can start already selecting (adding books to a known group)', () => {
    const { result } = renderHook(() => useSelection(true));
    expect(result.current.selecting).toBe(true);
  });
});
