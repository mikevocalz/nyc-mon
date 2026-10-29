import type { LifecycleStage, VoiceStage } from '../types/index.ts';

/**
 * How long a Baby keeps babbling after it hatches (Decision 32, Mike,
 * 2026-10-29): the first 24 hours of its first form.
 */
export const BABY_TALK_MS = 24 * 60 * 60 * 1000;

/** The two fields the voice stage reads. A Mon record satisfies it; so does an Egg (`{ stage: 'Egg' }`). */
export interface VoiceStageSubject {
  readonly stage: LifecycleStage;
  /** `MonInstance.hatchedAt`: the incubation end the hatch wrote, not a device clock. */
  readonly hatchedAt?: number | null;
}

function knownHatch(mon: VoiceStageSubject): number | undefined {
  return typeof mon.hatchedAt === 'number' && Number.isFinite(mon.hatchedAt) ? mon.hatchedAt : undefined;
}

/**
 * How much speech the Mon has right now (Bible v11 ¶56; Decision 32):
 *
 * - `baby-talk`: an Egg, or a Baby less than {@link BABY_TALK_MS} after
 *   `hatchedAt`. Wordless babble only.
 * - `limited`: a Baby after its first day. The family sound plus at most two
 *   words, never a sentence, no "Callah" (OPEN_QUESTIONS Q32).
 * - `full`: Small, Mid and Max.
 *
 * A pure function of its inputs, so every surface that passes the same clock
 * agrees. The server's answer is the one that decides what is spoken; a client
 * uses its own for local timing only. A clock behind the hatch time still
 * babbles (it never skips the first day). A Baby with no usable hatch time or
 * no usable clock speaks `limited`: babble is the first day only, so missing
 * data must not keep a Mon babbling forever.
 */
export function voiceStage(mon: VoiceStageSubject, now: number): VoiceStage {
  switch (mon.stage) {
    case 'Egg':
      return 'baby-talk';
    case 'Baby': {
      const hatchedAt = knownHatch(mon);
      if (hatchedAt === undefined || !Number.isFinite(now)) return 'limited';
      return now - hatchedAt < BABY_TALK_MS ? 'baby-talk' : 'limited';
    }
    case 'Small':
    case 'Mid':
    case 'Max':
      return 'full';
    default:
      // A stage this build does not know (bad data): never more than limited.
      return 'limited';
  }
}

/** When a Baby's babble ends (`hatchedAt + 24 h`); null for any other stage or an unknown hatch time. */
export function babyTalkEndsAt(mon: VoiceStageSubject): number | null {
  if (mon.stage !== 'Baby') return null;
  const hatchedAt = knownHatch(mon);
  return hatchedAt === undefined ? null : hatchedAt + BABY_TALK_MS;
}

const RANK: Readonly<Record<VoiceStage, number>> = { 'baby-talk': 0, limited: 1, full: 2 };

/**
 * The voice stage a server may act on when it only has the lifecycle stage and
 * a claimed voice stage (a client request, a tool result): never more speech
 * than the lifecycle allows. An Egg babbles; a Baby is at most `limited`; with
 * no claim a Baby is `limited` (its first-day babble needs `hatchedAt`, see
 * {@link voiceStage}).
 */
export function capVoiceStage(stage: LifecycleStage, claimed?: VoiceStage): VoiceStage {
  const ceiling: VoiceStage = stage === 'Egg' ? 'baby-talk' : stage === 'Small' || stage === 'Mid' || stage === 'Max' ? 'full' : 'limited';
  if (claimed === undefined || !(claimed in RANK)) return ceiling;
  return RANK[claimed] < RANK[ceiling] ? claimed : ceiling;
}
