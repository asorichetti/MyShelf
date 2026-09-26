import type { Fixture } from './types';

/**
 * Real Open Library cover URLs, so screens show real covers (the golden
 * path). Each id is the cover the app's own chain (src/services/covers)
 * chose and validated for that book's ISBN against the live APIs (September
 * 2026): a portrait image around 300x500 on covers.openlibrary.org. The
 * offline journeys answer these URLs with synthetic JPEGs; the `live` suite
 * loads the real images.
 */
const coverById = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
/** A cover that is always missing (it carries the suite's expected-404 marker), to prove the fallback. */
export const BROKEN_COVER = 'https://covers.openlibrary.org/b/id/__expected-404-L.jpg';

/**
 * A small, realistic library: 12 books across 4 genres; Discworld (#1, #2, #4)
 * and Earthsea (#1, #3) each have a gap; Pratchett, Le Guin and Christie have
 * several books; Dune is on loan, Roger Ackroyd is overdue, Mort was lent and
 * returned; one group ("Holiday reads"). Seven books are rated (Mort, Good
 * Omens and Pride and Prejudice 5 stars; The Colour of Magic and Dune 4; A
 * Wizard of Earthsea and The Hound of the Baskervilles 3), five are not.
 * Ten books have a real cover URL, The Farthest Shore has none and The
 * Murder of Roger Ackroyd's is broken.
 */
export const demo: Fixture = {
  books: [
    {
      title: 'The Colour of Magic',
      rating: 4,
      coverUri: coverById(7892565),
      authors: ['Terry Pratchett'],
      genres: ['Fantasy'],
      series: { name: 'Discworld', position: 1 },
      publisher: 'Corgi',
      publicationYear: 1983,
      pageCount: 285,
      format: 'paperback',
      language: 'en',
      isbn13: '9780552124751',
      summary: 'Rincewind, the Disc’s most inept wizard, is hired to guide its first tourist, Twoflower, through a world that rides on the back of a giant turtle.',
    },
    {
      title: 'The Light Fantastic',
      coverUri: coverById(7892569),
      authors: ['Terry Pratchett'],
      genres: ['Fantasy'],
      series: { name: 'Discworld', position: 2 },
      publisher: 'Corgi',
      publicationYear: 1986,
      pageCount: 241,
      format: 'paperback',
      language: 'en',
      isbn13: '9780552128483',
      summary: 'A red star is on a collision course with the Disc, and only Rincewind — who knows exactly one spell — can save it.',
    },
    {
      title: 'Mort',
      rating: 5,
      coverUri: coverById(7892579),
      authors: ['Terry Pratchett'],
      genres: ['Fantasy'],
      series: { name: 'Discworld', position: 4 },
      publisher: 'Corgi',
      publicationYear: 1987,
      pageCount: 272,
      format: 'paperback',
      language: 'en',
      isbn13: '9780552131063',
      summary: 'Death takes on an apprentice, and young Mort soon discovers that the job comes with a scythe, a horse called Binky and far too many rules.',
    },
    {
      title: 'Good Omens',
      rating: 5,
      coverUri: coverById(379638),
      subtitle: 'The Nice and Accurate Prophecies of Agnes Nutter, Witch',
      authors: ['Terry Pratchett', 'Neil Gaiman'],
      genres: ['Fantasy'],
      publisher: 'Gollancz',
      publicationYear: 1990,
      pageCount: 288,
      format: 'hardcover',
      edition: 'First edition',
      language: 'en',
      isbn13: '9780575048003',
      summary: 'An angel and a demon who have grown fond of Earth join forces to stop the Apocalypse, which is due next Saturday.',
    },
    {
      title: 'A Wizard of Earthsea',
      rating: 3,
      coverUri: coverById(9641870),
      authors: ['Ursula K. Le Guin'],
      genres: ['Fantasy'],
      series: { name: 'Earthsea', position: 1 },
      publisher: 'Puffin',
      publicationYear: 1968,
      pageCount: 205,
      format: 'paperback',
      language: 'en',
      isbn13: '9780140304770',
      summary: 'Ged, a gifted young mage, unleashes a shadow on the world and must hunt it across the islands of Earthsea.',
    },
    {
      title: 'The Farthest Shore',
      authors: ['Ursula K. Le Guin'],
      genres: ['Fantasy'],
      series: { name: 'Earthsea', position: 3 },
      publisher: 'Puffin',
      publicationYear: 1972,
      pageCount: 223,
      format: 'paperback',
      language: 'en',
      isbn13: '9780140306941',
    },
    {
      title: 'The Left Hand of Darkness',
      coverUri: coverById(284550),
      authors: ['Ursula K. Le Guin'],
      genres: ['Science Fiction'],
      publisher: 'Ace',
      publicationYear: 1969,
      pageCount: 304,
      format: 'paperback',
      language: 'en',
      isbn13: '9780441478125',
      summary: 'An envoy to the ice world of Gethen struggles to understand a people who have no fixed gender.',
    },
    {
      title: 'Dune',
      rating: 4,
      coverUri: coverById(15166231),
      authors: ['Frank Herbert'],
      genres: ['Science Fiction'],
      publisher: 'Ace',
      publicationYear: 1965,
      pageCount: 896,
      format: 'paperback',
      edition: '40th anniversary edition',
      language: 'en',
      isbn13: '9780441172719',
      summary:
        'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the “spice” melange, a drug capable of extending life and enhancing consciousness. ' +
        'When his family is betrayed, Paul and his mother flee into the deep desert, where they are taken in by the Fremen, the planet’s fierce native people. ' +
        'There Paul grows into a leader whose visions of the future may save Arrakis — or set the whole galaxy alight. ' +
        'A stunning blend of adventure and mysticism, environmentalism and politics, it won the first Nebula Award and shared the Hugo Award.',
      notes: 'Signed bookplate inside the front cover.',
    },
    {
      title: 'Murder on the Orient Express',
      coverUri: coverById(10252139),
      authors: ['Agatha Christie'],
      genres: ['Mystery'],
      publisher: 'HarperCollins',
      publicationYear: 1934,
      pageCount: 256,
      format: 'paperback',
      language: 'en',
      isbn13: '9780007119318',
      summary: 'Snowbound in the Balkans, a luxury train holds a murdered passenger, twelve suspects and Hercule Poirot.',
    },
    {
      title: 'The Murder of Roger Ackroyd',
      coverUri: BROKEN_COVER,
      authors: ['Agatha Christie'],
      genres: ['Mystery'],
      publisher: 'HarperCollins',
      publicationYear: 1926,
      pageCount: 288,
      format: 'paperback',
      language: 'en',
      isbn13: '9780007527526',
    },
    {
      title: 'The Hound of the Baskervilles',
      rating: 3,
      coverUri: coverById(13347460),
      authors: ['Arthur Conan Doyle'],
      genres: ['Mystery', 'Classics'],
      publisher: 'Penguin',
      publicationYear: 1902,
      pageCount: 256,
      format: 'paperback',
      language: 'en',
      isbn13: '9780141034324',
      summary: 'Sherlock Holmes and Dr Watson investigate a family curse and a spectral hound on the moors of Devon.',
    },
    {
      title: 'Pride and Prejudice',
      rating: 5,
      coverUri: coverById(12645114),
      authors: ['Jane Austen'],
      genres: ['Classics'],
      publisher: 'Penguin Classics',
      publicationYear: 1813,
      pageCount: 480,
      format: 'paperback',
      language: 'en',
      isbn13: '9780141439518',
      summary: 'Elizabeth Bennet and Mr Darcy misjudge each other thoroughly, and at length.',
      notes: 'Gift from Gran, Christmas 2009.',
    },
  ],
  loans: [
    { book: 'Dune', borrower: 'Sam', lentDaysAgo: 10, dueInDays: 11 },
    { book: 'The Murder of Roger Ackroyd', borrower: 'Priya', lentDaysAgo: 30, dueInDays: -5, note: 'Promised to bring it to book club.' },
    { book: 'Mort', borrower: 'Sam', lentDaysAgo: 90, dueInDays: -60, returnedDaysAgo: 62 },
  ],
  groups: [{ name: 'Holiday reads', icon: 'beach', books: ['Good Omens', 'Murder on the Orient Express', 'Pride and Prejudice'] }],
};
