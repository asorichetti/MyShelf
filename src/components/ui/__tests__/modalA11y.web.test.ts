/**
 * @jest-environment jsdom
 */
import { menuKeyProps, modalProps, returnTarget } from '@/components/ui/modalA11y.web';

function button(name: string, parent: HTMLElement = document.body): HTMLElement {
  const b = document.createElement('button');
  b.textContent = name;
  parent.appendChild(b);
  return b;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('returnTarget (P09-01)', () => {
  it('prefers the opener while it is on the page', () => {
    const help = button('Help');
    const opener = button('More help');
    expect(returnTarget(opener, [help, opener])).toBe(opener);
  });

  it('falls back to the modal’s named control, else the latest earlier focus still on the page and outside any modal', () => {
    const help = button('Help');
    const opener = button('More help');
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    const inside = button('Got it', modal);
    const tab = button('Settings');
    opener.remove();
    expect(returnTarget(opener, [help, tab, opener, inside])).toBe(tab);
    expect(returnTarget(opener, [help, tab, opener, inside], help)).toBe(help);
    tab.remove();
    expect(returnTarget(opener, [help, tab, opener, inside])).toBe(help);
    help.remove();
    expect(returnTarget(opener, [help, tab, opener, inside], help)).toBeNull();
  });
});

describe('modalProps', () => {
  it('names react-native-web’s own dialog wrapper after the modal', () => {
    expect(modalProps('Lend “Dune”')).toEqual({ 'aria-label': 'Lend “Dune”' });
  });
});

describe('menuKeyProps', () => {
  it('moves between menu items with the arrow keys, Home and End, wrapping round', () => {
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    const items = ['Edit', 'Refresh', 'Delete'].map((name) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.tabIndex = 0;
      item.textContent = name;
      menu.appendChild(item);
      return item;
    });
    const { onKeyDown } = menuKeyProps();
    const press = (key: string) => {
      const preventDefault = jest.fn();
      onKeyDown({ key, currentTarget: menu, preventDefault });
      return preventDefault;
    };
    items[0]!.focus();
    expect(press('ArrowDown')).toHaveBeenCalled();
    expect(document.activeElement).toBe(items[1]);
    press('End');
    expect(document.activeElement).toBe(items[2]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    press('ArrowUp');
    expect(document.activeElement).toBe(items[2]);
    press('Home');
    expect(document.activeElement).toBe(items[0]);
    expect(press('a')).not.toHaveBeenCalled();
  });
});
