import type { MonRosterLookup } from '../../server/mon-roster.ts';

/**
 * Test only: a roster that reports the Mon the /api/tts body names, at the
 * body's stage, hatched long ago. It trusts the body, which no production
 * lookup does; use it for tests of the handler's plumbing (voices, pitch,
 * headers). Tests of what the server lets a Mon say pass a fixed roster.
 */
export const trustClaim: MonRosterLookup = async (_authorization, claim) =>
  claim ? [{ speciesId: 'dex-001', stage: claim.stage, hatchedAt: 0, voiceLineageId: claim.lineageId }] : [];
