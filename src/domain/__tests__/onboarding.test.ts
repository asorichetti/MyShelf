import { needsOnboarding, welcomeTipsOn } from '../onboarding';

describe('first run', () => {
  it.each<[boolean | null, boolean, boolean]>([
    // done, e2e build, show the onboarding
    [null, false, true],
    [false, false, true],
    [true, false, false],
    [null, true, false],
    [false, true, true],
    [true, true, false],
  ])('onboarding.done=%s, e2e=%s -> onboarding: %s', (done, e2e, show) => {
    expect(needsOnboarding(done, e2e)).toBe(show);
  });

  it('welcome tips only once the onboarding is done', () => {
    expect(welcomeTipsOn(null)).toBe(false);
    expect(welcomeTipsOn(false)).toBe(false);
    expect(welcomeTipsOn(true)).toBe(true);
  });
});
