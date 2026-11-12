import type { Assumptions } from './types';

/**
 * The exercise's fixed assumptions. Every value here is a documented decision,
 * not a magic number hidden in the engine. See docs/decisions/0001-finance-rules.md.
 */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  asOf: '2026-10-31',
  timeZone: 'Asia/Kolkata',
  // INR per major unit, fixed for the exercise.
  inrPerUnit: { INR: 1, USD: 84, EUR: 91 },
  paypalPercent: 0.044,
  paypalFixedMinor: 30,
  gstPercent: 18,
  // GST applies because the supply is to a student in India, not because the
  // currency is INR. Both conditions must hold before GST is recognised.
  gstCountries: ['India'],
  firstInstalmentOffsetDays: 0,
  instalmentIntervalDays: 30,
  overdueIncludesDueToday: false,
};

export interface PartialAssumptions {
  asOf?: string;
  firstInstalmentOffsetDays?: number;
  overdueIncludesDueToday?: boolean;
}

export function resolveAssumptions(overrides: PartialAssumptions = {}): Assumptions {
  return { ...DEFAULT_ASSUMPTIONS, ...overrides };
}
