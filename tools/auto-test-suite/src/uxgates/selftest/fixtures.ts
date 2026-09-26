// HTML fixtures for the gate self-tests (gates.selftest.ts). One clean page
// that every gate accepts, and one variant per gate rule that breaks exactly
// that rule. Each variant lists the findings (gate/rule) it must produce, and
// nothing else may fire, so a fixture that accidentally breaks a second rule
// is caught as well as a rule that stopped firing.
//
// The pages use inline style attributes for everything a rule checks, so one
// variant can drop the only <style> element (render/stylesheets) without
// breaking any other rule, and load their web font through the FontFace API
// rather than @font-face for the same reason.

/** The gates config the fixtures are written against: every rule on. */
export const selfTestConfig = {
  render: { requiredTokens: ['--ms-color-primary'], landmarks: ['main', 'footer'], disabled: {} },
  a11y: { minTargetSize: 48, disabled: {} },
};

/** Where the runner expects the fixture font (copied from node_modules at test time). */
export const FontPath = 'fonts/body.ttf';

export interface Fixture {
  name: string;
  /** Exactly the error findings, as "gate/rule", this page must produce. */
  fires: string[];
  /** What the page does wrong, for the test name and the reader. */
  why: string;
  html: string;
  /** Load the page with API mocking on (MockIndexRoutes), as journeys do. */
  mock?: boolean;
}

/**
 * The fixture index the mocked pages run with: one deliberate 404 (marked
 * expected) and one ordinary answer. The runner writes it next to the pages.
 */
export const MockIndexRoutes = [
  { url: 'https://openlibrary.org/isbn/9791099999993.json', status: 404, body: 'not-found.html', expected: true },
  { url: 'https://openlibrary.org/isbn/9780552166591.json', body: 'edition.json' },
];
export const MockFiles: Record<string, string> = {
  'not-found.html': '<!doctype html><title>Page not found</title>',
  'edition.json': '{"title":"The Colour of Magic"}',
};

// A valid 1x1 PNG and a byte string no decoder accepts.
/** A small PNG the self-test serves as a file, like a real cover, for the lazy-image fixture. */
export const LazyImagePath = 'lazy.png';
export const LazyImagePng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const JUNK = 'base64,AAAAAAAA';

const TARGET = 'display:inline-block; box-sizing:border-box; min-width:48px; min-height:48px; padding:12px;';

interface Parts {
  lang: string | null;
  rootStyle: string;
  styleSheet: string | null;
  bodyStyle: string;
  fonts: string;
  skipLink: string;
  nav: string;
  mainStyle: string;
  main: string;
  after: string;
  scripts: string;
}

const cleanMain = (o: { h1?: string; h2?: string; img?: string; extra?: string } = {}) => `
    <div data-testid="page-content">
      ${o.h1 ?? '<h1>Fixture shelf</h1>'}
      <p>A clean page that every gate accepts. It has a <a href="#more">link in running text</a>, which the target-size rule exempts.</p>
      ${o.h2 ?? '<h2 id="more">More</h2>'}
      ${o.img ?? `<img alt="" src="${PNG}" width="16" height="16">`}
      <button type="button" style="${TARGET}">Borrow</button>
      <button type="button" disabled style="width:20px; height:20px; padding:0">x</button>
      <button type="button" style="display:none; width:10px; height:10px">hidden</button>
      ${o.extra ?? ''}
    </div>`;

const clean: Parts = {
  lang: 'en',
  rootStyle: '--ms-color-primary: #6B3FA8;',
  styleSheet: 'p { line-height: 1.4; }',
  bodyStyle: 'margin:0; background-color:#FBF6EC; color:#271D38; font-family: Fixture, sans-serif;',
  fonts: `const body = new FontFace('Fixture', 'url(/${FontPath})'); document.fonts.add(body); track(body.load());`,
  skipLink: `<a href="#main" style="${TARGET}">Skip to content</a>`,
  nav: `<nav aria-label="Primary"><a href="#top" style="${TARGET}">Top</a></nav>`,
  mainStyle: '',
  main: cleanMain(),
  after: '<footer>Fixture footer</footer>',
  scripts: '',
};

function page(p: Partial<Parts> = {}): string {
  const x = { ...clean, ...p };
  return `<!doctype html>
<html${x.lang === null ? '' : ` lang="${x.lang}"`} style="${x.rootStyle}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>gate fixture</title>
  ${x.styleSheet === null ? '' : `<style>${x.styleSheet}</style>`}
  <script>
    // The runner waits until every tracked promise has settled.
    window.__pending = 0;
    function track(p) { window.__pending++; Promise.resolve(p).catch(() => {}).finally(() => window.__pending--); }
  </script>
</head>
<body style="${x.bodyStyle}">
  ${x.skipLink}
  ${x.nav}
  <main id="main" style="${x.mainStyle}">${x.main}
  </main>
  ${x.after}
  <script>${x.fonts}</script>
  <script>${x.scripts}</script>
</body>
</html>
`;
}

export const fixtures: Fixture[] = [
  { name: 'clean', fires: [], why: 'breaks nothing', html: page() },
  {
    name: 'clean-expected-missing',
    fires: [],
    why: 'requests a URL carrying the expected-missing marker, which the console and network gates skip',
    html: page({ scripts: "track(fetch('/gone__expected-404.json'));" }),
  },
  {
    name: 'clean-mock-expected',
    fires: [],
    why: 'with API mocking on, gets a fixture answer and a fixture 404 marked expected, which the console and network gates skip',
    mock: true,
    html: page({
      scripts:
        "track(fetch('https://openlibrary.org/isbn/9780552166591.json').then((r) => r.json())); track(fetch('https://openlibrary.org/isbn/9791099999993.json'));",
    }),
  },

  // pagestate
  {
    name: 'pagestate-content-marker',
    fires: ['pagestate/content-marker'],
    why: 'never renders the page-content marker',
    html: page({ main: cleanMain().replace(' data-testid="page-content"', '') }),
  },
  {
    name: 'pagestate-error-marker',
    fires: ['pagestate/error-marker'],
    why: 'shows the page-error marker',
    html: page({ main: cleanMain({ extra: '<div data-testid="page-error">Something went wrong</div>' }) }),
  },
  {
    name: 'pagestate-main-text',
    fires: ['pagestate/main-text'],
    why: 'has under 10 characters of text in main',
    html: page({ main: '<p>Hi</p>', after: `<div data-testid="page-content"><h1>Outside main</h1></div><footer>Fixture footer</footer>` }),
  },

  // render
  { name: 'render-stylesheets', fires: ['render/stylesheets'], why: 'has no stylesheet at all', html: page({ styleSheet: null }) },
  { name: 'render-tokens', fires: ['render/tokens'], why: 'does not define the required --ms-color-primary on :root', html: page({ rootStyle: '' }) },
  {
    name: 'render-body-margin',
    fires: ['render/body-margin'],
    why: "keeps the browser's 8px body margin",
    html: page({ bodyStyle: clean.bodyStyle.replace('margin:0;', '') }),
  },
  {
    name: 'render-body-background',
    fires: ['render/body-background'],
    why: 'has a transparent body background',
    html: page({ bodyStyle: clean.bodyStyle.replace('background-color:#FBF6EC;', 'background-color:transparent;') }),
  },
  {
    name: 'render-body-font',
    fires: ['render/body-font'],
    why: 'sets the body in the default serif (main keeps the web font)',
    html: page({ bodyStyle: clean.bodyStyle.replace('font-family: Fixture, sans-serif;', 'font-family: serif;'), mainStyle: 'font-family: Fixture, sans-serif;' }),
  },
  {
    name: 'render-text-font',
    fires: ['render/text-font'],
    why: 'renders the first text in main in the default serif',
    html: page({ main: cleanMain({ h1: '<h1 style="font-family: serif">Fixture shelf</h1>' }) }),
  },
  { name: 'render-fonts-loaded', fires: ['render/fonts-loaded'], why: 'loads no web font', html: page({ fonts: '' }) },
  {
    name: 'render-fonts-error',
    fires: ['render/fonts-error'],
    why: 'declares a font whose data does not decode',
    html: page({
      fonts: `${clean.fonts}
      const broken = new FontFace('Broken', 'url(data:font/ttf;${JUNK})');
      document.fonts.add(broken);
      track(broken.load());`,
    }),
  },
  {
    name: 'clean-lazy-offscreen',
    fires: [],
    why: 'has a lazy image far down a scrolling list, which the browser has not asked for yet (a long list at 200 % text); the gate asks for it and it loads',
    html: page({
      main: cleanMain({ extra: `<div style="height:200px; overflow-y:auto"><div style="height:9000px"></div><img alt="" loading="lazy" src="/${LazyImagePath}" width="16" height="16"></div>` }),
    }),
  },
  {
    name: 'render-images',
    fires: ['render/images'],
    why: 'has an image that does not decode',
    html: page({ main: cleanMain({ img: `<img alt="" src="data:image/png;${JUNK}" width="16" height="16">` }) }),
  },
  {
    name: 'render-overflow',
    fires: ['render/overflow'],
    why: 'has a 3000px wide element',
    html: page({ main: cleanMain({ extra: '<div data-testid="too-wide" style="width:3000px; height:4px"></div>' }) }),
  },
  {
    name: 'render-landmarks',
    fires: ['render/landmarks'],
    why: 'hides the required footer landmark',
    html: page({ after: '<footer style="display:none">Fixture footer</footer>' }),
  },

  // a11y
  { name: 'a11y-one-h1', fires: ['a11y/one-h1'], why: 'has two h1s', html: page({ main: cleanMain({ extra: '<h1>Second h1</h1>' }) }) },
  {
    name: 'a11y-heading-order',
    fires: ['a11y/heading-order'],
    why: 'skips from h1 to h3',
    html: page({ main: cleanMain({ h2: '<h3 id="more">More</h3>' }) }),
  },
  {
    name: 'a11y-img-alt',
    fires: ['a11y/img-alt'],
    why: 'has an img without an alt attribute',
    html: page({ main: cleanMain({ img: `<img src="${PNG}" width="16" height="16">` }) }),
  },
  {
    name: 'a11y-accessible-name',
    fires: ['a11y/accessible-name'],
    why: 'has a button with no accessible name',
    html: page({ main: cleanMain({ extra: `<button type="button" style="${TARGET}"></button>` }) }),
  },
  {
    name: 'a11y-skip-link',
    fires: ['a11y/skip-link'],
    why: 'starts with a link to another page instead of a skip link',
    // Without the skip link the nav's in-page #top link would pass for one.
    html: page({ skipLink: '', nav: clean.nav.replace('href="#top"', 'href="/shelf"') }),
  },
  {
    name: 'a11y-one-main',
    fires: ['a11y/one-main'],
    why: 'has two visible main landmarks',
    html: page({ after: '<main><p>A second main landmark</p></main><footer>Fixture footer</footer>' }),
  },
  {
    name: 'a11y-nav-labels',
    fires: ['a11y/nav-labels'],
    why: 'has a nav without a label',
    html: page({ nav: clean.nav.replace(' aria-label="Primary"', '') }),
  },
  { name: 'a11y-html-lang', fires: ['a11y/html-lang'], why: 'has no lang on <html>', html: page({ lang: null }) },
  {
    name: 'a11y-target-size',
    fires: ['a11y/target-size'],
    why: 'has a 30x30 px button',
    html: page({ main: cleanMain({ extra: '<button type="button" aria-label="Close" style="width:30px; height:30px; padding:0">x</button>' }) }),
  },
  {
    name: 'a11y-target-size-lone-link',
    fires: ['a11y/target-size'],
    why: 'has a small link standing alone rather than inside running text',
    html: page({ main: cleanMain({ extra: '<p><a href="#more">More</a></p>' }) }),
  },

  // console
  {
    name: 'console-error',
    fires: ['console/error'],
    why: 'logs a console error',
    html: page({ scripts: "console.error('fixture: deliberate console error');" }),
  },
  {
    name: 'console-pageerror',
    fires: ['console/pageerror'],
    why: 'throws an uncaught exception',
    html: page({ scripts: "throw new Error('fixture: deliberate uncaught error');" }),
  },

  // network. Chromium also logs every failed resource load as a console error,
  // so these fire the console gate too; that is the browser, not the fixture.
  {
    name: 'network-http-status',
    fires: ['network/http-status', 'console/error'],
    why: 'requests a missing file, which the static server answers with a real 404',
    html: page({ scripts: "track(fetch('/missing.json'));" }),
  },
  {
    name: 'network-unmocked',
    fires: ['network/unmocked', 'console/error'],
    why: 'with API mocking on, requests a Google Books URL that no fixture answers, which the mock aborts',
    mock: true,
    html: page({ scripts: "track(fetch('https://www.googleapis.com/books/v1/volumes?q=isbn%3A9780000000002'));" }),
  },
  {
    name: 'network-request-failed',
    fires: ['network/request-failed', 'console/error'],
    why: 'requests a port nothing listens on',
    html: page({ scripts: "track(fetch('http://127.0.0.1:9/'));" }),
  },
];
