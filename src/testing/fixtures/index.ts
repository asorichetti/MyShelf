import { demo } from './demo';
import { empty } from './empty';
import { firstRun } from './firstRun';
import { large } from './large';
import { series } from './series';

import type { Fixture } from './types';

export const fixtures = { empty, 'first-run': firstRun, demo, large, series } satisfies Record<string, Fixture>;

export type FixtureName = keyof typeof fixtures;

export const fixtureNames = Object.keys(fixtures) as FixtureName[];

export function isFixtureName(name: string): name is FixtureName {
  return Object.prototype.hasOwnProperty.call(fixtures, name);
}

export type { Fixture, FixtureBook, FixtureGroup, FixtureLoan } from './types';
