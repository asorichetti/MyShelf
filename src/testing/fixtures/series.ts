import type { Fixture } from './types';

/**
 * Series whose links came from a metadata guess (P04-03): Guards! Guards! was
 * detected as Discworld #8 with low confidence and The Name of the Wind as
 * The Kingkiller Chronicle #1 with medium confidence, so both pages ask
 * "Is this …?". The Colour of Magic (Discworld #1) was entered by hand.
 * Same shape as a lookup-and-save would leave behind, without the network.
 */
export const series: Fixture = {
  books: [
    {
      title: 'The Colour of Magic',
      authors: ['Terry Pratchett'],
      genres: ['Fantasy'],
      series: { name: 'Discworld', position: 1 },
      publicationYear: 1983,
      isbn13: '9780552124751',
    },
    {
      title: 'Guards! Guards!',
      authors: ['Terry Pratchett'],
      genres: ['Fantasy'],
      series: { name: 'Discworld', position: 8, detected: 'low' },
      publicationYear: 1989,
      isbn13: '9780552134637',
    },
    {
      title: 'The Name of the Wind',
      authors: ['Patrick Rothfuss'],
      genres: ['Fantasy'],
      series: { name: 'The Kingkiller Chronicle', position: 1, detected: 'medium' },
      publicationYear: 2007,
      isbn13: '9780756404741',
    },
  ],
};
