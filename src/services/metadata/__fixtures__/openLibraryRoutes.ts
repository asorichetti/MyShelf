/**
 * Recorded Open Library responses (September 2026), keyed by the URL the
 * provider requests. Trimmed of bulky fields (source records, identifiers,
 * long subject lists) but otherwise as received.
 */
import { withQuery } from '@/services/http/url';
import type { FixtureRoutes } from '@/testing/fixtureFetch';

import author_OL21594A from './openlibrary/author-OL21594A.json';
import author_OL23919A from './openlibrary/author-OL23919A.json';
import author_OL25712A from './openlibrary/author-OL25712A.json';
import author_OL26320A from './openlibrary/author-OL26320A.json';
import author_OL27363A from './openlibrary/author-OL27363A.json';
import author_OL31353A from './openlibrary/author-OL31353A.json';
import author_OL31901A from './openlibrary/author-OL31901A.json';
import author_OL7234434A from './openlibrary/author-OL7234434A.json';
import author_OL79034A from './openlibrary/author-OL79034A.json';
import edition_OL17852114M from './openlibrary/edition-OL17852114M.json';
import edition_OL18986719M from './openlibrary/edition-OL18986719M.json';
import edition_OL22597282M from './openlibrary/edition-OL22597282M.json';
import edition_OL25726767M from './openlibrary/edition-OL25726767M.json';
import edition_OL26420821M from './openlibrary/edition-OL26420821M.json';
import edition_OL28477029M from './openlibrary/edition-OL28477029M.json';
import edition_OL37076991M from './openlibrary/edition-OL37076991M.json';
import edition_OL45506127M from './openlibrary/edition-OL45506127M.json';
import edition_OL47313596M from './openlibrary/edition-OL47313596M.json';
import edition_OL7814893M from './openlibrary/edition-OL7814893M.json';
import edition_OL9567312M from './openlibrary/edition-OL9567312M.json';
import editions_OL453657W from './openlibrary/editions-OL453657W.json';
import search_ali_hazelwood from './openlibrary/search-ali-hazelwood.json';
import search_q_colour_of_magic_pratchett from './openlibrary/search-colour-of-magic-pratchett.json';
import search_colour_of_magic from './openlibrary/search-colour-of-magic.json';
import search_nobodys_girl from './openlibrary/search-nobody-s-girl-virginia-roberts-giuffre.json';
import search_practical_magic from './openlibrary/search-practical-magic-alice-hoffman.json';
import search_problematic_bromance from './openlibrary/search-problematic-summer-bromance-ali-hazelwood.json';
import search_q_dune from './openlibrary/search-q-dune.json';
import search_q_the_colour_of_magic_terry_pratchett from './openlibrary/search-the-colour-of-magic-terry-pratchett.json';
import work_OL10263W from './openlibrary/work-OL10263W.json';
import work_OL17091839W from './openlibrary/work-OL17091839W.json';
import work_OL274505W from './openlibrary/work-OL274505W.json';
import work_OL27513W from './openlibrary/work-OL27513W.json';
import work_OL34952014W from './openlibrary/work-OL34952014W.json';
import work_OL453657W from './openlibrary/work-OL453657W.json';
import work_OL453749W from './openlibrary/work-OL453749W.json';
import work_OL59855W from './openlibrary/work-OL59855W.json';
import work_OL66554W from './openlibrary/work-OL66554W.json';
import work_OL82563W from './openlibrary/work-OL82563W.json';
import work_OL893414W from './openlibrary/work-OL893414W.json';

const OL = 'https://openlibrary.org';
const SEARCH_FIELDS = 'key,title,author_name,first_publish_year,edition_count,isbn,cover_i,subject,language,author_key';

/** The recorded books, by the ISBN-13 used to look them up. */
export const OL_BOOKS = {
  colourOfMagic: '9780552166591', // Corgi paperback; series "Discworld, Book 1"; work description is {type, value}
  philosophersStone: '9780747532699', // Bloomsbury hardback; series "Harry Potter, #1"; authors only on the work
  prideAndPrejudice: '9780141439518', // Penguin Classics paperback; multi-edition classic
  theMartian: '9780553418026', // standalone novel; authors only on the work
  petitPrince: '9782070612758', // French; publish_date "March 2007"
  fellowship: '9780345339706', // recorded as ISBN-10 0345339703; the edition has isbn_10 only
  cienAnos: '9788497592208', // Spanish; isbn_10 only, no cover, no physical_format
  dune: '9780441172719', // Ace 1987 (ISBN-10 0441172717); two isbn_10s, "pagination" but no format
  movingPictures: '9780552134637', // Corgi (ISBN-10 0552134635); series "Discworld, part 10"; edition subjects
  noDescription: '9780000000002', // real junk record: no authors, no work description, no subjects
  farthestShore: '9780140306941', // Puffin 1974 (recorded later, for Refresh details); no cover; imprint series "Puffin books"
  unknown: '9791099999993', // valid checksum, unknown to Open Library: 404 with an HTML body
} as const;

const json = (body: unknown) => ({ body });

export const openLibraryRoutes: FixtureRoutes = {
  [`${OL}/isbn/${OL_BOOKS.colourOfMagic}.json`]: json(edition_OL28477029M),
  [`${OL}/isbn/${OL_BOOKS.philosophersStone}.json`]: json(edition_OL25726767M),
  [`${OL}/isbn/${OL_BOOKS.prideAndPrejudice}.json`]: json(edition_OL37076991M),
  [`${OL}/isbn/${OL_BOOKS.theMartian}.json`]: json(edition_OL26420821M),
  [`${OL}/isbn/${OL_BOOKS.petitPrince}.json`]: json(edition_OL9567312M),
  [`${OL}/isbn/${OL_BOOKS.fellowship}.json`]: json(edition_OL45506127M),
  [`${OL}/isbn/${OL_BOOKS.cienAnos}.json`]: json(edition_OL18986719M),
  [`${OL}/isbn/${OL_BOOKS.dune}.json`]: json(edition_OL22597282M),
  [`${OL}/isbn/${OL_BOOKS.movingPictures}.json`]: json(edition_OL7814893M),
  [`${OL}/isbn/${OL_BOOKS.noDescription}.json`]: json(edition_OL47313596M),
  [`${OL}/isbn/${OL_BOOKS.unknown}.json`]: { status: 404, text: '<!DOCTYPE html>\n<html lang="en"><head><title>Page not found</title></head></html>' },

  [`${OL}/works/OL10263W.json`]: json(work_OL10263W),
  [`${OL}/works/OL17091839W.json`]: json(work_OL17091839W),
  [`${OL}/works/OL274505W.json`]: json(work_OL274505W),
  [`${OL}/works/OL27513W.json`]: json(work_OL27513W),
  [`${OL}/works/OL34952014W.json`]: json(work_OL34952014W),
  [`${OL}/works/OL453657W.json`]: json(work_OL453657W),
  [`${OL}/works/OL453749W.json`]: json(work_OL453749W),
  [`${OL}/isbn/${OL_BOOKS.farthestShore}.json`]: json(edition_OL17852114M),
  [`${OL}/works/OL59855W.json`]: json(work_OL59855W),
  [`${OL}/authors/OL31353A.json`]: json(author_OL31353A),
  [`${OL}/works/OL66554W.json`]: json(work_OL66554W),
  [`${OL}/works/OL82563W.json`]: json(work_OL82563W),
  [`${OL}/works/OL893414W.json`]: json(work_OL893414W),

  [`${OL}/authors/OL21594A.json`]: json(author_OL21594A),
  [`${OL}/authors/OL23919A.json`]: json(author_OL23919A),
  [`${OL}/authors/OL25712A.json`]: json(author_OL25712A),
  [`${OL}/authors/OL26320A.json`]: json(author_OL26320A),
  [`${OL}/authors/OL27363A.json`]: json(author_OL27363A),
  [`${OL}/authors/OL31901A.json`]: json(author_OL31901A),
  [`${OL}/authors/OL7234434A.json`]: json(author_OL7234434A),
  [`${OL}/authors/OL79034A.json`]: json(author_OL79034A),

  [withQuery(`${OL}/search.json`, { title: 'the colour of magic', author: 'pratchett', fields: SEARCH_FIELDS, limit: 10 })]:
    json(search_colour_of_magic),
  [withQuery(`${OL}/search.json`, { q: 'dune frank herbert', fields: SEARCH_FIELDS, limit: 10 })]: json(search_q_dune),
  // Free-text searches as the lookup field and the typed cover text send them.
  [withQuery(`${OL}/search.json`, { q: 'colour of magic pratchett', fields: SEARCH_FIELDS, limit: 10 })]: json(search_q_colour_of_magic_pratchett),
  [withQuery(`${OL}/search.json`, { q: 'the colour of magic terry pratchett', fields: SEARCH_FIELDS, limit: 10 })]:
    json(search_q_the_colour_of_magic_terry_pratchett),
  [`${OL}/works/OL453657W/editions.json?limit=50`]: json(editions_OL453657W),
  // The searches the real cover captures (src/domain/__fixtures__/ocr/real-*.json) make, recorded September 2026.
  [withQuery(`${OL}/search.json`, { title: 'problematic summer bromance', author: 'ali hazelwood', fields: SEARCH_FIELDS, limit: 10 })]: json(search_problematic_bromance),
  [withQuery(`${OL}/search.json`, { author: 'ali hazelwood', fields: SEARCH_FIELDS, limit: 10 })]: json(search_ali_hazelwood),
  [withQuery(`${OL}/search.json`, { title: 'practical magic', author: 'alice hoffman', fields: SEARCH_FIELDS, limit: 10 })]: json(search_practical_magic),
  [withQuery(`${OL}/search.json`, { title: "nobody's girl", author: 'virginia roberts giuffre', fields: SEARCH_FIELDS, limit: 10 })]: json(search_nobodys_girl),
};

/** Raw fixtures for mapper tests. */
export const olFixtures = {
  editions: {
    colourOfMagic: edition_OL28477029M,
    philosophersStone: edition_OL25726767M,
    prideAndPrejudice: edition_OL37076991M,
    theMartian: edition_OL26420821M,
    petitPrince: edition_OL9567312M,
    fellowship: edition_OL45506127M,
    cienAnos: edition_OL18986719M,
    dune: edition_OL22597282M,
    movingPictures: edition_OL7814893M,
    noDescription: edition_OL47313596M,
  },
  works: {
    colourOfMagic: work_OL453657W,
    philosophersStone: work_OL82563W,
    prideAndPrejudice: work_OL66554W,
    theMartian: work_OL17091839W,
    petitPrince: work_OL10263W,
    fellowship: work_OL27513W,
    cienAnos: work_OL274505W,
    dune: work_OL893414W,
    movingPictures: work_OL453749W,
    noDescription: work_OL34952014W,
  },
  searchColourOfMagic: search_colour_of_magic,
  searchDune: search_q_dune,
  editionsColourOfMagic: editions_OL453657W,
};
