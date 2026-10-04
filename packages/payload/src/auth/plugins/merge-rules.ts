// Pure rules for joining two Caller accounts (ADR 0004 §3). Kept apart from
// the endpoint so they run in Vitest without a database.

/** The `users` fields the rules read. */
export interface MergeCandidate {
  id: string;
  birthYear: number | null | undefined;
  consentStatus: string | null | undefined;
}

/** Why a merge was refused. */
export type MergeRefusal =
  | 'MERGE_SAME_ACCOUNT'
  | 'MERGE_CONSENT_ACCOUNT'
  | 'MERGE_BIRTH_YEAR_MISMATCH'
  | 'MERGE_PROVIDER_CONFLICT';

/** A sign-in method row as the merge sees it. */
export interface MergeAccountRow {
  id: string;
  providerId: string;
}

/**
 * Checks that two accounts may be joined. Accounts created through guardian
 * consent are never merged in Phase 1, and two different birth years usually
 * mean two people.
 */
export function checkMergeEligibility(a: MergeCandidate, b: MergeCandidate): MergeRefusal | undefined {
  if (a.id === b.id) return 'MERGE_SAME_ACCOUNT';
  if (a.consentStatus !== 'not-required' || b.consentStatus !== 'not-required') return 'MERGE_CONSENT_ACCOUNT';
  const aYear = a.birthYear ?? undefined;
  const bYear = b.birthYear ?? undefined;
  if (aYear !== undefined && bYear !== undefined && aYear !== bYear) return 'MERGE_BIRTH_YEAR_MISMATCH';
  return undefined;
}

/** The birth year the survivor keeps: its own, or the merged account's when it had none. */
export function survivingBirthYear(survivor: MergeCandidate, merged: MergeCandidate): number | undefined {
  return survivor.birthYear ?? merged.birthYear ?? undefined;
}

/** What happens to each of the merged account's sign-in methods. */
export interface AccountPlan {
  /** Rows that move to the survivor. */
  move: string[];
  /** Password rows dropped because the survivor already has one. */
  drop: string[];
  /** Social providers both accounts use; the merge stops until one is unlinked. */
  conflicts: string[];
}

/**
 * Plans the sign-in methods. A password on both sides keeps the survivor's.
 * The same Apple or Google provider on both sides is a conflict: each row
 * is a different external identity, and Better Auth allows one per provider.
 */
export function planAccounts(survivorRows: readonly MergeAccountRow[], mergedRows: readonly MergeAccountRow[]): AccountPlan {
  const survivorProviders = new Set(survivorRows.map((row) => row.providerId));
  const plan: AccountPlan = { move: [], drop: [], conflicts: [] };
  for (const row of mergedRows) {
    if (!survivorProviders.has(row.providerId)) {
      plan.move.push(row.id);
    } else if (row.providerId === 'credential') {
      plan.drop.push(row.id);
    } else {
      plan.conflicts.push(row.providerId);
    }
  }
  return plan;
}

/** Characters for merge codes: no 0/O or 1/I, so a code read aloud survives. */
export const MERGE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MERGE_CODE_LENGTH = 8;

/** Normalises a typed code: upper case, spaces and dashes removed. */
export function normaliseMergeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}
