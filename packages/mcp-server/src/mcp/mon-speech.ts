import { deriveVoiceLineageId, type EggRecord, type LifecycleStage, type MonMood, type VoiceStage, voiceStage } from '@acme/core';
import { planMonUtterance, type MonLingo, type MonVoiceRef } from '@acme/content/voice';

/**
 * What the Mon may say on the Alexa path (Decision 32).
 *
 * Alexa+ writes the reply and reads it in Alexa's own voice, so the server
 * cannot filter the final speech. For a Mon that babbles (an Egg, a Baby in
 * its first 24 hours) the result carries the exact line to say, gated here,
 * plus a rule telling the agent to add no words for the Mon. For a `limited`
 * Baby it carries a canon line inside the limit, when one exists, and states
 * the limit. A Small, Mid or Max Mon speaks in full: nothing is added.
 */

/** A ready-made Mon line. `verbatim: true` means say exactly `text` and nothing else for the Mon. */
export interface MonSay {
  /** What Alexa reads: gated for the voice stage, no stage directions. */
  readonly text: string;
  /** What a screen shows for the same line. */
  readonly caption: string;
  readonly voiceStage: VoiceStage;
  readonly verbatim: boolean;
}

/** The fields a tool result adds: both absent for a Mon that speaks in full. */
export interface MonSpeech {
  readonly say?: MonSay;
  readonly speechRule?: string;
}

export const BABY_TALK_RULE =
  'The Mon only babbles right now. When the Mon speaks, say say.text exactly as written and add no words for the Mon. Anything else you say is in your own plain voice.';

export const LIMITED_RULE =
  'The Mon is a Baby past its first day: its family sound plus at most two words, never a sentence, and no "Callah". Use say.text when given, or a line inside that limit.';

/** Occasions a canon line is keyed by (`MonLineEntry.occasion`). */
export type MonOccasion = 'hello' | 'hungry' | 'played' | 'first-words';

/** Same seed within a minute, so a retried or repeated call says the same thing. */
const SEED_BUCKET_MS = 60_000;

function seedFor(subjectId: string, occasion: string, now: number): string {
  return `${subjectId}|${occasion}|${Math.floor(now / SEED_BUCKET_MS)}`;
}

function sayLine(text: string, ref: MonVoiceRef, lingo: MonLingo, seed: string, verbatim: boolean): MonSay {
  const plan = planMonUtterance(text, ref, lingo, { seed });
  return { text: plan.plainSpoken, caption: plan.caption, voiceStage: plan.voiceStage, verbatim };
}

/** A babble line for a babbling voice: the gate replaces the empty line with seeded babble. */
function babble(ref: MonVoiceRef, lingo: MonLingo, seed: string): MonSpeech {
  return { say: sayLine('', ref, lingo, seed, true), speechRule: BABY_TALK_RULE };
}

function canonLine(lingo: MonLingo, speciesId: string, stage: LifecycleStage, occasion: MonOccasion, mood: MonMood | undefined): string | undefined {
  const fits = (o: string) =>
    lingo.lines.find((l) => l.speciesId === speciesId && l.stage === stage && l.occasion === o && (l.mood === null || l.mood === mood));
  return (fits(occasion) ?? fits('hello'))?.text;
}

/**
 * The speech fields for a hatched Mon at `now`. A Mon with no voice lineage
 * (hatched before lineages) still follows its stage; its babble is drawn from
 * the shared syllables only.
 */
export function monSpeech(
  mon: { readonly monInstanceId: string; readonly speciesId: string; readonly stage: LifecycleStage; readonly hatchedAt: number; readonly voiceLineageId: string | null },
  mood: MonMood | undefined,
  occasion: MonOccasion,
  lingo: MonLingo,
  now: number,
): MonSpeech {
  const stage = voiceStage(mon, now);
  if (stage === 'full') return {};
  const ref: MonVoiceRef = { lineageId: mon.voiceLineageId ?? mon.speciesId, stage: mon.stage, voiceStage: stage, mood };
  const seed = seedFor(mon.monInstanceId, occasion, now);
  if (stage === 'baby-talk') return babble(ref, lingo, seed);
  const canon = canonLine(lingo, mon.speciesId, mon.stage, occasion, mood);
  if (canon === undefined) return { speechRule: LIMITED_RULE };
  return { say: sayLine(canon, ref, lingo, seed, false), speechRule: LIMITED_RULE };
}

/** An incubating egg's voice and babble. An Egg has no MonInstance yet; its lineage comes from the egg record. */
export function eggSpeech(egg: Pick<EggRecord, 'eggId' | 'speciesId'>, lingo: MonLingo, now: number) {
  const voice = { lineageId: deriveVoiceLineageId(egg), stage: 'Egg' as const, voiceStage: 'baby-talk' as const };
  const { say } = babble(voice, lingo, seedFor(egg.eggId, 'hello', now));
  return { voice, say: say! };
}

