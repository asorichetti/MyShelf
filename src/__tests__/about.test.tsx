import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { AboutScreen, licenceSummary } from '@/features/settings/AboutScreen';
import licences from '@/generated/licences.json';
import { renderWithTheme, settle } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));

const A = Testids.about;
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { dependencies: Record<string, string> };

describe('About screen', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows the version, the credits, the licence and one h1', async () => {
    renderWithTheme(<AboutScreen />);
    await settle();
    expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1).map((h) => h.props.children)).toEqual(['About MyShelf']);
    expect(screen.getByTestId(A.version).props.children).toMatch(/^Version \d+\.\d+\.\d+ · /);
    expect(screen.getByText('Book data from Open Library (Internet Archive) and Google Books.')).toBeOnTheScreen();
    expect(screen.getByText(/under the MIT licence/)).toBeOnTheScreen();
  });

  it('opens the GitHub repository and the privacy notes in the browser', async () => {
    renderWithTheme(<AboutScreen />);
    await act(async () => fireEvent.press(screen.getByTestId(A.repoLink)));
    expect(Linking.openURL).toHaveBeenCalledWith('https://github.com/asorichetti/MyShelf');
    await act(async () => fireEvent.press(screen.getByTestId(A.privacyLink)));
    expect(Linking.openURL).toHaveBeenLastCalledWith('https://github.com/asorichetti/MyShelf/blob/main/docs/privacy.md');
    expect(screen.getByTestId(A.repoLink).props.accessibilityLabel).toBe('MyShelf on GitHub (opens in your browser)');
  });

  it('lists every package with its licence when asked', async () => {
    renderWithTheme(<AboutScreen />);
    expect(screen.queryAllByTestId(A.licenceRow)).toHaveLength(0);
    await act(async () => fireEvent.press(screen.getByTestId(A.licencesToggle)));
    expect(screen.getAllByTestId(A.licenceRow)).toHaveLength(licences.packages.length);
  });

  it('never mentions an assistant or a language model', () => {
    renderWithTheme(<AboutScreen />);
    const all = JSON.stringify(screen.toJSON());
    expect(all).not.toMatch(/\b(AI|GPT|LLM|Claude|assistant|language model)\b/i);
  });
});

describe('licences.json', () => {
  it('includes every production dependency of the app', () => {
    const names = new Set(licences.packages.map((p) => p.name));
    const missing = Object.keys(pkg.dependencies).filter((d) => !names.has(d));
    expect(missing).toEqual([]);
  });

  it('has a licence for each package, and a summary by licence', () => {
    expect(licences.packages.every((p) => p.license)).toBe(true);
    expect(licenceSummary([
      { name: 'a', version: '1', license: 'MIT' },
      { name: 'b', version: '1', license: 'ISC' },
      { name: 'c', version: '1', license: 'MIT' },
    ])).toBe('2 MIT, 1 ISC');
  });
});
