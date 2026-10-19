import type { ResumeResult } from '@acme/core';
import { assertNever } from '@acme/core';
import type { District } from '@acme/ui';
import type { ResumeFailure, ResumeSummary } from '@acme/ui/lobby';

// `ResumeResult` (@acme/core `resolveResume`) → `ResumeSummary` (what the
// lobby shows). Exhaustive on both unions. The save's `districtId` is the
// dataset's id string; it is shown only when it names one of the kit's four
// districts, else the resume line has no district and START's name omits it.
// Types only from the kit: a value import of `@acme/ui` would load React
// Native under `node --test`.

const DISTRICT_IDS: readonly District[] = ['downtown', 'midtown', 'harlem', 'megacity'];

export function districtOfId(districtId: string | null): District | undefined {
  if (districtId === null) return undefined;
  return DISTRICT_IDS.find((district) => district === districtId);
}

function failureOf(reason: Extract<ResumeResult, { kind: 'error' }>['reason']): ResumeFailure {
  switch (reason) {
    case 'incompatible-dataset':
      return { kind: 'dataset-incompatible' };
    case 'corrupt':
      return { kind: 'save-unreadable' };
    case 'future-version':
    case 'not-owner':
      return { kind: 'unknown' };
    default:
      return assertNever(reason);
  }
}

/** `offline` marks an eligible save with no network; the lobby adds the `g02.resume.offline` strip. */
export function toResumeSummary(result: ResumeResult | null, offline = false): ResumeSummary {
  if (result === null) return { kind: 'none' };
  switch (result.kind) {
    case 'new-game':
      return { kind: 'none' };
    case 'resume': {
      const district = districtOfId(result.save.districtId);
      const base = { district, savedAtMs: result.save.savedAt, revision: result.save.revision };
      return offline ? { kind: 'offline', ...base } : { kind: 'eligible', ...base };
    }
    case 'error':
      return { kind: 'failed', reason: failureOf(result.reason), recovery: result.recovery };
    default:
      return assertNever(result);
  }
}
