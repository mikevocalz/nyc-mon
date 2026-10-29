import { careCopy } from './care-copy.ts';

/**
 * Care-call notification planner (contract §7), the pure half. Input is what
 * `predictRealCalls(state, now, CARE_HORIZON_MS, options)` and
 * `selectMonCareView(...).paused` return in `@acme/core/sim`; the types here
 * are structural copies of contract §3 so this file runs under `node --test`
 * without the core build. The native half (`care-notifications.native.ts`)
 * reads the phone's pending requests, runs {@linkcode reconcileCareSchedule}
 * and applies the result.
 *
 * Rules:
 * - one notification per predicted REAL call; false calls never notify;
 * - nothing while paused, and nothing when the Caller has alerts off or the OS
 *   denies them;
 * - only calls strictly after `now` and within 24 h;
 * - calls within {@linkcode COALESCE_MS} of an earlier one fold into it (Mon
 *   Space shows every open call; one banner is enough);
 * - at most {@linkcode MAX_CARE_NOTIFICATIONS} per Mon;
 * - identifiers are `mon-care:<mon>:<kind>:<n>` (n = order of that kind in the
 *   plan), so a reschedule on every tick or action updates in place and never
 *   duplicates.
 */

export type CareCallKind = 'hunger' | 'energy' | 'social' | 'cold' | 'bedtime' | 'false-call';
export type RealCallKind = Exclude<CareCallKind, 'false-call'>;

const REAL_CALL_KINDS: ReadonlySet<string> = new Set<RealCallKind>(['hunger', 'energy', 'social', 'cold', 'bedtime']);

export function isRealCallKind(kind: unknown): kind is RealCallKind {
  return typeof kind === 'string' && REAL_CALL_KINDS.has(kind);
}

/** One element of `predictRealCalls(...)`. */
export interface PredictedCall {
  readonly kind: CareCallKind;
  readonly at: number;
}

export const CARE_HORIZON_MS = 24 * 60 * 60 * 1000;
export const COALESCE_MS = 5 * 60 * 1000;
/** iOS keeps 64 pending requests per app; the egg alert and schedule reminders share them. */
export const MAX_CARE_NOTIFICATIONS = 12;
/** Canon v12 route for the care experience (DECISIONS.md #23, GAMEPLAY_BIBLE_V12 §Mon Space). */
export const MON_SPACE_PATHNAME = '/mon-space';
const ID_PREFIX = 'mon-care:';
const FALLBACK_TITLE = 'Your Mon';

export interface CarePlanInput {
  readonly monInstanceId: string;
  /** Nickname, or the species name before naming. */
  readonly monName: string;
  readonly now: number;
  readonly predictions: readonly PredictedCall[];
  readonly paused: boolean;
  /** The Mon calls switch (`devicePrefs().monCalls`, off by default, D20b) is on AND the OS permission is granted. */
  readonly enabled: boolean;
  /**
   * Canon `character` lines by call kind (`notify.call.<kind>.line`, from
   * `monLine`). A non-empty line replaces the `ui` body. Today only hunger has
   * one, for the Squeaklet at Baby ("Food?").
   */
  readonly lines?: Partial<Record<RealCallKind, string | undefined>>;
}

/** `content.data` of a care-call notification; the tap handler routes on it. */
export interface CareCallData {
  readonly kind: 'mon-care-call';
  readonly monInstanceId: string;
  readonly callKind: RealCallKind;
  readonly at: number;
  readonly url: typeof MON_SPACE_PATHNAME;
}

export interface CareNotificationRequest {
  readonly identifier: string;
  readonly at: number;
  readonly callKind: RealCallKind;
  readonly title: string;
  readonly body: string;
  readonly threadIdentifier: string;
  readonly data: CareCallData;
}

export function careNotificationId(monInstanceId: string, kind: RealCallKind, ordinal: number): string {
  return `${ID_PREFIX}${monInstanceId}:${kind}:${ordinal}`;
}

/** Any Mon's care call. */
export function isCareNotificationId(identifier: string): boolean {
  return identifier.startsWith(ID_PREFIX);
}

export function isCareNotificationFor(identifier: string, monInstanceId: string): boolean {
  return identifier.startsWith(`${ID_PREFIX}${monInstanceId}:`);
}

export function planCareNotifications(input: CarePlanInput): CareNotificationRequest[] {
  if (!input.enabled || input.paused) return [];
  const end = input.now + CARE_HORIZON_MS;
  const real = input.predictions
    .filter((p): p is PredictedCall & { kind: RealCallKind } => isRealCallKind(p.kind))
    .filter((p) => p.at > input.now && p.at <= end)
    .sort((a, b) => a.at - b.at);

  const kept: (PredictedCall & { kind: RealCallKind })[] = [];
  for (const call of real) {
    const last = kept[kept.length - 1];
    if (last !== undefined && call.at - last.at < COALESCE_MS) continue;
    kept.push(call);
    if (kept.length === MAX_CARE_NOTIFICATIONS) break;
  }

  const name = input.monName.trim() || FALLBACK_TITLE;
  const ordinals = new Map<RealCallKind, number>();
  return kept.map((call) => {
    const ordinal = ordinals.get(call.kind) ?? 0;
    ordinals.set(call.kind, ordinal + 1);
    return {
      identifier: careNotificationId(input.monInstanceId, call.kind, ordinal),
      at: call.at,
      callKind: call.kind,
      title: careCopy(`notify.call.${call.kind}.title`, { name }),
      body: input.lines?.[call.kind]?.trim() || careCopy(`notify.call.${call.kind}.body`, { name }),
      threadIdentifier: `${ID_PREFIX}${input.monInstanceId}`,
      data: { kind: 'mon-care-call', monInstanceId: input.monInstanceId, callKind: call.kind, at: call.at, url: MON_SPACE_PATHNAME },
    };
  });
}

/** Validates a received `content.data`. Anything else is not a care call (Law 5). */
export function parseCareCallData(data: unknown): CareCallData | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.kind !== 'mon-care-call' || d.url !== MON_SPACE_PATHNAME) return null;
  if (typeof d.monInstanceId !== 'string' || d.monInstanceId.length === 0) return null;
  if (!isRealCallKind(d.callKind) || typeof d.at !== 'number' || !Number.isFinite(d.at)) return null;
  return { kind: 'mon-care-call', monInstanceId: d.monInstanceId, callKind: d.callKind, at: d.at, url: MON_SPACE_PATHNAME };
}

/** The parts of an expo-notifications `NotificationRequest` the reconcile reads. */
export interface ScheduledCareLike {
  readonly identifier: string;
  readonly content: { readonly body?: string | null; readonly data?: unknown };
}

export interface CareScheduleChange {
  readonly cancel: string[];
  readonly schedule: CareNotificationRequest[];
}

/**
 * What to cancel and what to schedule so the phone holds exactly `desired`
 * for this Mon. Requests are compared by id, fire time and body, so a moved
 * call is cancelled first and then re-added under the same id (expo-notifications
 * 58 does not document replace-on-same-id, so the code never relies on it).
 */
export function reconcileCareSchedule(
  scheduled: readonly ScheduledCareLike[],
  desired: readonly CareNotificationRequest[],
  monInstanceId: string,
): CareScheduleChange {
  const want = new Map(desired.map((r) => [r.identifier, r]));
  const have = new Set<string>();
  const cancel: string[] = [];
  for (const request of scheduled) {
    if (!isCareNotificationFor(request.identifier, monInstanceId)) continue;
    const target = want.get(request.identifier);
    const data = parseCareCallData(request.content.data);
    if (target !== undefined && data !== null && data.at === target.at && request.content.body === target.body) {
      have.add(request.identifier);
    } else {
      cancel.push(request.identifier);
    }
  }
  return { cancel, schedule: desired.filter((r) => !have.has(r.identifier)) };
}
