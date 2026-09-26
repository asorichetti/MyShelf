import { userAgent } from '../userAgent';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));

const { userAgent: webUserAgent } = jest.requireActual<typeof import('../userAgent.web')>('../userAgent.web');

describe('userAgent', () => {
  it('identifies the app and its version on native', () => {
    expect(userAgent()).toBe('MyShelf/1.2.3 (+https://github.com/asorichetti/MyShelf)');
  });

  it('sends none on web, where browsers forbid the header', () => {
    expect(webUserAgent()).toBeUndefined();
  });
});
