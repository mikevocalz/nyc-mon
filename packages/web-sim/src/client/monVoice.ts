import { gateMonLine, type MonVoiceRef, readMonVoiceRef } from '@acme/content/voice';
import { capVoiceStage, voiceStage as voiceStageAt, type VoiceStage } from '@acme/core';
import type { TranscriptItem } from './session.ts';

/** The voice a Mon speaks with, as the MCP tools report it in `mon.voice` (`@acme/content/voice`). */
export type MonVoice = MonVoiceRef;

/**
 * The current Mon's voice: `mon.voice` from the latest tool result that
 * carries a Mon (get_mon_status, check_on_mon, the care tools). Undefined when
 * no result has a Mon yet or that Mon has no lineage, so the caller uses the
 * plain Web Speech voice. `mood` comes from that result's top-level `mood`
 * when it has a valid one. `voiceStage` is the server's at the time of that
 * result (Decision 32).
 */
export function currentMonVoice(items: readonly TranscriptItem[]): MonVoice | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item?.kind !== 'tool') continue;
    const structured = item.result.structuredContent as { mon?: unknown; mood?: unknown } | undefined;
    const mon = structured?.mon;
    if (typeof mon !== 'object' || mon === null) continue;
    return readMonVoiceRef((mon as { voice?: unknown }).voice, structured?.mood);
  }
  return undefined;
}

/**
 * One line of the Mon as this voice may say it: babble for an Egg or a
 * first-day Baby, two words at most for a later Baby (`gateMonLine`). The
 * server gates the reply before it gets here; this keeps the caption and the
 * clip on the same text when it did not (an older server, a canned line).
 */
export function gatedLine(text: string, voice: MonVoice | undefined): string {
  // Nothing to say stays nothing: the gate would turn an empty line into babble.
  return voice === undefined || text.trim() === '' ? text : gateMonLine(text, voice).text;
}

/**
 * The voice stage now, for local timing only (when ambient babble stops): from
 * the Mon's `hatchedAt` as the tool result reported it, so a first day that
 * ends while the page is open ends here too; the reported stage without one.
 * The server still decides what is said.
 */
export function liveVoiceStage(voice: MonVoice | undefined, hatchedAt: number | undefined, now: number): VoiceStage | undefined {
  if (voice === undefined) return undefined;
  if (hatchedAt === undefined) return capVoiceStage(voice.stage, voice.voiceStage);
  return capVoiceStage(voice.stage, voiceStageAt({ stage: voice.stage, hatchedAt }, now));
}
