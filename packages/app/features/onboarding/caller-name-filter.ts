'use client';

import type { CallerNameFilter } from '@acme/core/sim';

/**
 * The platform-owned Caller-name block list (M07 B4). Stored locally and
 * matched after NFC normalisation, trim and case-folding, so the check never
 * needs the network. This is the seed list — the launch list is tested
 * against names from the communities `V11 ¶53` lists before ship
 * (`06-critique.md` blocker 2), and entries are added here only.
 */
export const CALLER_NAME_BLOCKLIST: readonly string[] = [
  // Common English profanity and slurs a child would most plausibly try.
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'retard', 'kike', 'spic', 'chink', 'gook',
  'wetback', 'tranny', 'dyke', 'rape',
];

/** Exact-match filter over {@linkcode CALLER_NAME_BLOCKLIST} entries after NFC/trim/case-fold. */
export function createCallerNameFilter(blocked: readonly string[] = CALLER_NAME_BLOCKLIST): CallerNameFilter {
  const set = new Set(blocked.map((word) => word.normalize('NFC').trim().toLowerCase()));
  return { isBlocked: (name) => set.has(name.normalize('NFC').trim().toLowerCase()) };
}

/** The filter M07 wires by default. */
export const defaultCallerNameFilter: CallerNameFilter = createCallerNameFilter();
