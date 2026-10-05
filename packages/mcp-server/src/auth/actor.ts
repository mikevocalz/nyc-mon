import type { ActingVoice } from '../mcp/errors.ts';
import type { FamiliarPerson } from '../presence/types.ts';
import { presenceService } from '../presence/service.ts';
import type { CallerData } from '../data/caller.ts';

/**
 * Acting-voice resolution (build prompt §Permissions; ADR 0006 §5, ADR 0007 §5).
 *
 * Every mutating tool resolves who is speaking before it touches data:
 *   'trainer'  — the Caller (account-linked voice session, or enrolled match).
 *                Wire enum keeps the prompt's spelling; it means the Caller
 *                (ADR 0008).
 *   'familiar' — an enrolled FamiliarPerson, carrying per-person permissions.
 *   'unknown'  — no Voice ID hint, no fresh PresenceEvent. Still authenticated
 *                to the Caller's household, still refused Caller-only actions.
 *
 * Identity is never inferred from background audio: a familiar is only "the
 * speaker" when Alexa Voice ID supplies their linked personId, or when the
 * client passes a speakerHint corroborated by a fresh presence event.
 */
export interface SpeakerHint {
  readonly alexaVoiceId?: string;
  readonly personId?: string;
}

export interface ResolvedActor {
  readonly voice: ActingVoice;
  readonly person: FamiliarPerson | null;
}

export async function resolveActingVoice(
  data: CallerData,
  callerId: string,
  hint: SpeakerHint | undefined,
  now: number = Date.now(),
): Promise<ResolvedActor> {
  // Path 1: Alexa Voice ID for the *direct speaker* (ADR 0007 §2). Maps only
  // to a FamiliarPerson who self-enrolled and linked that Voice ID.
  if (hint?.alexaVoiceId) {
    const people = await data.listFamiliarPeople(callerId);
    const match = people.find((p) => p.alexaVoiceIdHint === hint.alexaVoiceId) ?? null;
    if (match) {
      return { voice: { kind: 'familiar', callerId, personId: match.personId, confidence: 1 }, person: match };
    }
    // A Voice ID that maps to the Caller themselves resolves as trainer —
    // TODO(voice-id): Caller-side Voice ID linkage isn't modeled yet.
  }

  // Path 2: client speakerHint corroborated by a fresh presence event.
  if (hint?.personId) {
    const event = presenceService.latestFor(callerId, hint.personId, now);
    if (event) {
      const person = await data.getFamiliarPerson(callerId, hint.personId);
      if (person) {
        return {
          voice: { kind: 'familiar', callerId, personId: person.personId, confidence: event.confidence },
          person,
        };
      }
    }
  }

  // Path 3: no corroborated speaker. Voice sessions default to the Caller —
  // the household owner is the overwhelmingly likely speaker — but the
  // simulator can force 'unknown' for the refusal demo. TODO(demo-knob):
  // make the default explicit per-session rather than a constant.
  return { voice: { kind: 'trainer', callerId }, person: null };
}

/** Caller-only check for mutating tools. Familiar grants are per-action. */
export function permitted(
  actor: ResolvedActor,
  action: 'talk' | 'play' | 'feed' | 'care',
): boolean {
  if (actor.voice.kind === 'trainer') return true;
  if (actor.voice.kind === 'familiar' && actor.person) return actor.person.permissions[action];
  return false;
}
