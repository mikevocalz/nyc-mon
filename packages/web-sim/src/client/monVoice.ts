import { LIFECYCLE_STAGES, type LifecycleStage, MON_MOODS, type MonMood } from '@acme/core';
import type { TranscriptItem } from './session.ts';

/** The voice a Mon speaks with, as the MCP tools report it in `mon.voice`. */
export interface MonVoice {
  readonly lineageId: string;
  readonly stage: LifecycleStage;
  /** The Mon's mood from the same tool result; sets how the line is delivered. */
  readonly mood?: MonMood;
}

function isMood(value: unknown): value is MonMood {
  return (MON_MOODS as readonly unknown[]).includes(value);
}

function isStage(value: unknown): value is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly unknown[]).includes(value);
}

/**
 * The current Mon's voice: `mon.voice` from the latest tool result that
 * carries a Mon (get_mon_status, check_on_mon, the care tools). Undefined when
 * no result has a Mon yet or that Mon has no lineage, so the caller uses the
 * plain Web Speech voice. `mood` comes from that result's top-level `mood`
 * when it has a valid one.
 */
export function currentMonVoice(items: readonly TranscriptItem[]): MonVoice | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item?.kind !== 'tool') continue;
    const structured = item.result.structuredContent as { mon?: unknown; mood?: unknown } | undefined;
    const mon = structured?.mon;
    if (typeof mon !== 'object' || mon === null) continue;
    const voice = (mon as { voice?: unknown }).voice;
    if (typeof voice !== 'object' || voice === null) return undefined;
    const { lineageId, stage } = voice as { lineageId?: unknown; stage?: unknown };
    if (typeof lineageId !== 'string' || !isStage(stage)) return undefined;
    const mood = structured?.mood;
    return isMood(mood) ? { lineageId, stage, mood } : { lineageId, stage };
  }
  return undefined;
}
