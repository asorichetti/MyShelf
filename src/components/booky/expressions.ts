import { catalogueWords } from './format';

export const bookyExpressions = ['happy', 'thinking', 'excited', 'sleepy', 'concerned'] as const;

export type BookyExpression = (typeof bookyExpressions)[number];

/** Human description used in Booky's accessible label (read from the catalogue, `booky.expressions.*`). */
export const expressionDescriptions: Readonly<Record<BookyExpression, string>> = catalogueWords({
  happy: 'booky.expressions.happy',
  thinking: 'booky.expressions.thinking',
  excited: 'booky.expressions.excited',
  sleepy: 'booky.expressions.sleepy',
  concerned: 'booky.expressions.concerned',
});
