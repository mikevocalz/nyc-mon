import type { FamiliarDirectory } from '../presence/fixtures.ts';
import type { PresenceService } from '../presence/service.ts';
import type { FamiliarPerson, Permission } from '../presence/types.ts';

/**
 * Who is speaking on a turn (ADR 0006 §5, ADR 0007 §5, ADR 0008).
 *
 * - `caller`: the linked account holder. Every turn on a real Alexa device
 *   resolves here, because Alexa+ forwards no speaker identity to MCP servers
 *   (PLATFORM-DOCS §2.14).
 * - `familiar`: a seeded fictional person, only in dev and simulator mode,
 *   and only when the client names them in `speakerHint` and a fresh presence
 *   event corroborates it.
 * - `unverified`: the client named someone other than the Caller, but no fresh
 *   presence event or fixture backs it. Talking is allowed; care is not, so a
 *   hint can only ever narrow what a turn may do.
 */
export type ActingVoice =
  | { readonly kind: 'caller' }
  | { readonly kind: 'unverified'; readonly personId: string }
  | { readonly kind: 'familiar'; readonly person: FamiliarPerson; readonly confidence: number };

/** Simulator-only input: which familiar person the client believes is speaking. */
export interface SpeakerHint {
  readonly personId: string;
}

export interface ActorSources {
  readonly familiar: FamiliarDirectory | undefined;
  readonly presence: PresenceService;
}

export function resolveActingVoice(
  sources: ActorSources,
  callerId: string,
  hint: SpeakerHint | undefined,
  now: number,
): ActingVoice {
  if (hint === undefined) return { kind: 'caller' };
  const unverified = { kind: 'unverified', personId: hint.personId } as const;
  if (sources.familiar === undefined) return unverified;
  const event = sources.presence.latestFor(callerId, hint.personId, now);
  if (event === null) return unverified;
  const person = sources.familiar.getPerson(callerId, hint.personId);
  if (person === undefined) return unverified;
  return { kind: 'familiar', person, confidence: event.confidence };
}

/** The Caller may do anything; a familiar person what their grants allow; an unverified voice may only talk. */
export function permitted(actor: ActingVoice, action: keyof Permission): boolean {
  if (actor.kind === 'caller') return true;
  if (actor.kind === 'unverified') return action === 'talk';
  return actor.person.permissions[action];
}
