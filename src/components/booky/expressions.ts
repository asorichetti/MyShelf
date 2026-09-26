export const bookyExpressions = ['happy', 'thinking', 'excited', 'sleepy', 'concerned'] as const;

export type BookyExpression = (typeof bookyExpressions)[number];

/** Human description used in Booky's accessible label. */
export const expressionDescriptions: Record<BookyExpression, string> = {
  happy: 'smiling happily',
  thinking: 'thinking',
  excited: 'looking excited',
  sleepy: 'looking sleepy',
  concerned: 'looking concerned',
};
