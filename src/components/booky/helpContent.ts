import type { MessageKey } from '@/i18n';

import { catalogueWords, messageTemplate } from './format';

import type { HelpScreen } from './tips';

/**
 * The help sheet's words (P07-05): a few short sections per screen, opened
 * from Booky's help tip ("More help") or, with Booky off, straight from the
 * screen's help button. Same copy rules as the tips (see `tips.ts`), with a
 * little more room: each section at most three short sentences. The words
 * are in the i18n catalogue (`help.*`); these objects read them when read.
 */

export interface HelpSection {
  heading: string;
  body: string;
}

export interface HelpContent {
  title: string;
  sections: readonly HelpSection[];
}

const section = (heading: MessageKey, body: MessageKey): HelpSection => catalogueWords({ heading, body });

function sheet(title: MessageKey, sections: readonly HelpSection[]): HelpContent {
  return Object.defineProperty({ sections }, 'title', { get: () => messageTemplate(title), enumerable: true }) as HelpContent;
}

/** Shared by the book's card and the editions screen. */
const edition = section('help.edition.heading', 'help.edition.body');

export const helpContent: Record<HelpScreen, HelpContent> = {
  shelf: sheet('help.shelf.title', [
    section('help.shelf.finding.heading', 'help.shelf.finding.body'),
    section('help.shelf.sorting.heading', 'help.shelf.sorting.body'),
    section('help.shelf.selecting.heading', 'help.shelf.selecting.body'),
  ]),
  scan: sheet('help.scan.title', [
    section('help.scan.isbn.heading', 'help.scan.isbn.body'),
    section('help.scan.noBarcode.heading', 'help.scan.noBarcode.body'),
    section('help.scan.pile.heading', 'help.scan.pile.body'),
  ]),
  loans: sheet('help.loans.title', [
    section('help.loans.lending.heading', 'help.loans.lending.body'),
    section('help.loans.returned.heading', 'help.loans.returned.body'),
    section('help.loans.reminders.heading', 'help.loans.reminders.body'),
  ]),
  groups: sheet('help.groups.title', [
    section('help.groups.what.heading', 'help.groups.what.body'),
    section('help.groups.adding.heading', 'help.groups.adding.body'),
    section('help.groups.order.heading', 'help.groups.order.body'),
  ]),
  settings: sheet('help.settings.title', [
    section('help.settings.chatty.heading', 'help.settings.chatty.body'),
    section('help.settings.muted.heading', 'help.settings.muted.body'),
  ]),
  book: sheet('help.book.title', [
    section('help.book.editing.heading', 'help.book.editing.body'),
    section('help.book.rating.heading', 'help.book.rating.body'),
    edition,
    section('help.book.lending.heading', 'help.book.lending.body'),
  ]),
  editions: sheet('help.editions.title', [
    edition,
    section('help.editions.mine.heading', 'help.editions.mine.body'),
    section('help.editions.unsure.heading', 'help.editions.unsure.body'),
  ]),
  series: sheet('help.series.title', [
    section('help.series.gaps.heading', 'help.series.gaps.body'),
    section('help.series.total.heading', 'help.series.total.body'),
    section('help.series.tidying.heading', 'help.series.tidying.body'),
  ]),
};
