import { tipById, type BookyExpression } from '@/components/booky';

export interface OnboardingPage {
  expression: BookyExpression;
  title: string;
  text: string;
}

/** The four first-run cards (P07-03). Booky's words, short and warm. */
export const onboardingPages: readonly OnboardingPage[] = [
  { expression: 'happy', title: 'Welcome to MyShelf', text: `${tipById('welcome').text} I’ll help you catalogue every book you own.` },
  { expression: 'thinking', title: 'Scan to add a book', text: 'Scan the barcode on the back, or let me read the cover. I’ll fill in the title, author and series.' },
  { expression: 'happy', title: 'Lend without worry', text: 'Lend a book to a friend and I’ll keep track of who has it and when it’s due back.' },
  { expression: 'sleepy', title: 'Yours, and only yours', text: 'Everything stays on your phone. No account, no cloud, just your books.' },
];
