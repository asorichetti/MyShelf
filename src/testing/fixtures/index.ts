import { demo } from './demo';
import { empty } from './empty';
import { large } from './large';

import type { Fixture } from './types';

export const fixtures = { empty, demo, large } satisfies Record<string, Fixture>;

export type FixtureName = keyof typeof fixtures;

export const fixtureNames = Object.keys(fixtures) as FixtureName[];

export function isFixtureName(name: string): name is FixtureName {
  return Object.prototype.hasOwnProperty.call(fixtures, name);
}

export type { Fixture, FixtureBook, FixtureGroup, FixtureLoan } from './types';
