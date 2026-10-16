import type { GeoPosition, WorldCamera, WorldSave } from '../schemas/world-save.ts';
import { assertNever } from '../sim/assert-never.ts';
import { type DatasetMigration, parseWorldSave, WorldSaveLoadError } from './migrate.ts';
import { isInsideSceneExtent, projectToScene, rebaseCamera, type ScenePoint } from './transform.ts';

// Lobby START → which save, if any, the player resumes into (Master
// Directive v2 §3 "Resume sequence", steps "validate identity", "find the
// latest eligible save", "resolve version compatibility"). Pure and
// synchronous: every candidate is already in memory, so the lobby can decide
// before the world loads and the first visible gameplay frame is the resumed
// one. The world load itself (chunks, geometry) is the app's job after this.
//
// Conflict rule. Candidates are ordered by (revision desc, savedAt desc).
// Revision is the primary key because it only ever rises on a durable write,
// so a higher revision is a later state of the same world no matter which
// device wrote it or when its clock said it did. savedAt breaks ties: two
// devices that both advanced from the same synced base reach the same
// revision, and the later write wins. A local snapshot with a lower revision
// than a synced one is therefore stale and is rejected, never written back
// over the newer one (§3 "never overwrite a newer valid session with an older
// offline snapshot"). On a full tie the local copy is kept, so an offline
// resume does not wait on a download of bytes it already has.

export type ResumeCandidateSource = 'local' | 'remote';

/** One stored save as found: the MMKV string already JSON-decoded, or a server body. Not yet validated. */
export interface ResumeCandidate {
  readonly source: ResumeCandidateSource;
  readonly blob: unknown;
}

/** The dataset the scene is about to load, so saves can be checked and rebased against it. */
export interface ResumeDataset {
  readonly datasetId: string;
  readonly datasetVersion: number;
  readonly originRef: GeoPosition;
}

export interface ResolveResumeInput {
  readonly candidates: readonly ResumeCandidate[];
  /** Epoch ms. Only used for the "saved N ago" status; never to reject a save. */
  readonly now: number;
  /** The signed-in Caller. A save for anyone else is rejected as `not-owner`. */
  readonly ownerId: string;
  readonly dataset: ResumeDataset;
  /** Coordinate migrations between dataset versions. Absent or empty means none exist. */
  readonly datasetMigrations?: readonly DatasetMigration[];
}

/** Why one candidate was not the one resumed. Every candidate ends up either resumed or listed here. */
export type ResumeRejectionReason =
  | 'corrupt'
  | 'invalid'
  | 'future-version'
  | 'missing-migration'
  | 'not-owner'
  | 'incompatible-dataset'
  | 'stale-revision'
  | 'older-same-revision'
  | 'duplicate';

export interface RejectedCandidate {
  readonly source: ResumeCandidateSource;
  readonly reason: ResumeRejectionReason;
  /** Present when the blob parsed far enough to read one. */
  readonly revision?: number;
}

export type ResumeFailure = 'not-owner' | 'incompatible-dataset' | 'corrupt' | 'future-version';
export type ResumeRecovery = 'start-new' | 'retry-sync' | 'keep-waiting';

/** Produced by {@linkcode resolveResume}; map it with an exhaustive `switch`. */
export type ResumeResult =
  | { readonly kind: 'new-game'; readonly rejected: readonly RejectedCandidate[] }
  | {
      readonly kind: 'resume';
      /** The winning save, with position and dataset already migrated to the current dataset when needed. */
      readonly save: WorldSave;
      /** The camera in the current dataset's scene space (rebased if the origin moved). */
      readonly camera: WorldCamera;
      /** Compass bearing in radians clockwise from north. */
      readonly heading: number;
      /** The player's canonical position projected into the current dataset's scene space. */
      readonly scene: ScenePoint;
      /** `now − savedAt`, floored at 0 for a device clock that went backwards. */
      readonly savedAgoMs: number;
      readonly rejected: readonly RejectedCandidate[];
    }
  | {
      readonly kind: 'error';
      readonly reason: ResumeFailure;
      readonly recovery: ResumeRecovery;
      readonly rejected: readonly RejectedCandidate[];
    };

interface Eligible {
  readonly source: ResumeCandidateSource;
  readonly save: WorldSave;
}

type Screened = { readonly ok: true; readonly eligible: Eligible } | { readonly ok: false; readonly rejected: RejectedCandidate };

/**
 * Decides what lobby START does. `new-game` only when there is no candidate
 * at all; one or more candidates that all fail is an `error` with the most
 * actionable reason and a recovery the lobby offers, never a quiet spawn.
 */
export function resolveResume(input: ResolveResumeInput): ResumeResult {
  if (input.candidates.length === 0) return { kind: 'new-game', rejected: [] };

  const screened = input.candidates.map((candidate) => screen(candidate, input));
  const rejected: RejectedCandidate[] = [];
  const eligible: Eligible[] = [];
  for (const result of screened) {
    if (result.ok) eligible.push(result.eligible);
    else rejected.push(result.rejected);
  }

  if (eligible.length === 0) {
    const reason = worstFailure(rejected);
    return { kind: 'error', reason, recovery: recoveryFor(reason, input.candidates), rejected };
  }

  eligible.sort(compareNewestFirst);
  const winner = eligible[0]!;
  for (const loser of eligible.slice(1)) {
    rejected.push({ source: loser.source, revision: loser.save.revision, reason: rejectionAgainst(winner.save, loser.save) });
  }

  const { save } = winner;
  return {
    kind: 'resume',
    save,
    camera: save.camera,
    heading: save.headingRadians,
    scene: projectToScene(save.position, input.dataset.originRef),
    savedAgoMs: Math.max(0, input.now - save.savedAt),
    rejected,
  };
}

function screen(candidate: ResumeCandidate, input: ResolveResumeInput): Screened {
  let save: WorldSave;
  try {
    save = parseWorldSave(candidate.blob);
  } catch (error) {
    if (!(error instanceof WorldSaveLoadError)) throw error;
    const revision = readRevision(candidate.blob);
    return { ok: false, rejected: revision === undefined ? { source: candidate.source, reason: error.reason } : { source: candidate.source, reason: error.reason, revision } };
  }
  if (save.playerId !== input.ownerId) {
    return { ok: false, rejected: { source: candidate.source, reason: 'not-owner', revision: save.revision } };
  }
  const migrated = migrateToDataset(save, input);
  if (migrated === undefined) {
    return { ok: false, rejected: { source: candidate.source, reason: 'incompatible-dataset', revision: save.revision } };
  }
  return { ok: true, eligible: { source: candidate.source, save: migrated } };
}

/**
 * Brings a save onto the current dataset. Same id and version: unchanged.
 * Different version: walk the dataset migration chain, moving the canonical
 * position, then re-project the camera onto the new origin. No chain, a
 * different dataset id, or a rebased camera outside the scene extent:
 * `undefined`, which the caller reports as `incompatible-dataset`.
 */
function migrateToDataset(save: WorldSave, input: ResolveResumeInput): WorldSave | undefined {
  const { dataset } = input;
  if (save.dataset.datasetId !== dataset.datasetId) return undefined;
  // Same dataset, same origin: the save is already in this scene space. Return
  // it untouched so reopening never moves a double by even one ulp (fixture 3).
  if (save.dataset.datasetVersion === dataset.datasetVersion && sameOrigin(save.dataset.originRef, dataset.originRef)) return save;
  let position = save.position;
  let version = save.dataset.datasetVersion;
  const migrations = input.datasetMigrations ?? [];
  while (version !== dataset.datasetVersion) {
    const step = migrations.find((m) => m.datasetId === dataset.datasetId && m.fromDatasetVersion === version);
    if (step === undefined) return undefined;
    position = step.migratePosition(position);
    version = step.toDatasetVersion;
  }
  const camera = rebaseCamera(save.camera, save.dataset.originRef, dataset.originRef);
  if (!isInsideSceneExtent(camera) || !isInsideSceneExtent(projectToScene(position, dataset.originRef))) return undefined;
  return {
    ...save,
    position,
    camera,
    dataset: { datasetId: dataset.datasetId, datasetVersion: dataset.datasetVersion, originRef: dataset.originRef },
  };
}

function sameOrigin(a: GeoPosition, b: GeoPosition): boolean {
  return a.longitude === b.longitude && a.latitude === b.latitude;
}

function compareNewestFirst(a: Eligible, b: Eligible): number {
  if (a.save.revision !== b.save.revision) return b.save.revision - a.save.revision;
  if (a.save.savedAt !== b.save.savedAt) return b.save.savedAt - a.save.savedAt;
  // Full tie: keep the local copy (no download for bytes already on the device).
  return sourceRank(a.source) - sourceRank(b.source);
}

function sourceRank(source: ResumeCandidateSource): number {
  switch (source) {
    case 'local':
      return 0;
    case 'remote':
      return 1;
    default:
      return assertNever(source);
  }
}

function rejectionAgainst(winner: WorldSave, loser: WorldSave): ResumeRejectionReason {
  if (loser.revision < winner.revision) return 'stale-revision';
  if (loser.savedAt < winner.savedAt) return 'older-same-revision';
  return 'duplicate';
}

/** The reason the lobby shows when nothing was eligible, most actionable first. */
const FAILURE_PRIORITY: readonly ResumeFailure[] = ['future-version', 'incompatible-dataset', 'corrupt', 'not-owner'];

function failureOf(reason: ResumeRejectionReason): ResumeFailure | undefined {
  switch (reason) {
    case 'future-version':
      return 'future-version';
    case 'incompatible-dataset':
      return 'incompatible-dataset';
    case 'corrupt':
    case 'invalid':
    case 'missing-migration':
      return 'corrupt';
    case 'not-owner':
      return 'not-owner';
    case 'stale-revision':
    case 'older-same-revision':
    case 'duplicate':
      return undefined;
    default:
      return assertNever(reason);
  }
}

function worstFailure(rejected: readonly RejectedCandidate[]): ResumeFailure {
  const failures = new Set(rejected.map((r) => failureOf(r.reason)));
  return FAILURE_PRIORITY.find((f) => failures.has(f)) ?? 'corrupt';
}

/**
 * - `future-version`: a newer build wrote it; this build must update. `keep-waiting`.
 * - `incompatible-dataset`: no coordinate migration exists. The player chooses `start-new`.
 * - `corrupt`: `retry-sync` when no remote copy was tried yet, else `start-new`.
 * - `not-owner`: another Caller's world is on this device. `start-new`.
 */
function recoveryFor(reason: ResumeFailure, candidates: readonly ResumeCandidate[]): ResumeRecovery {
  switch (reason) {
    case 'future-version':
      return 'keep-waiting';
    case 'incompatible-dataset':
      return 'start-new';
    case 'corrupt':
      return candidates.some((c) => c.source === 'remote') ? 'start-new' : 'retry-sync';
    case 'not-owner':
      return 'start-new';
    default:
      return assertNever(reason);
  }
}

function readRevision(blob: unknown): number | undefined {
  if (typeof blob !== 'object' || blob === null) return undefined;
  const revision = (blob as { revision?: unknown }).revision;
  return typeof revision === 'number' && Number.isInteger(revision) ? revision : undefined;
}
