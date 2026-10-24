import { LIFECYCLE_STAGES, type LifecycleStage } from '@acme/core';
import type { TranscriptItem } from './session.ts';

/** The voice a Mon speaks with, as the MCP tools report it in `mon.voice`. */
export interface MonVoice {
  readonly lineageId: string;
  readonly stage: LifecycleStage;
}

function isStage(value: unknown): value is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly unknown[]).includes(value);
}

/**
 * The current Mon's voice: `mon.voice` from the latest tool result that
 * carries a Mon (get_mon_status, check_on_mon, the care tools). Undefined when
 * no result has a Mon yet or that Mon has no lineage, so the caller uses the
 * plain Web Speech voice.
 */
export function currentMonVoice(items: readonly TranscriptItem[]): MonVoice | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item?.kind !== 'tool') continue;
    const mon = (item.result.structuredContent as { mon?: unknown } | undefined)?.mon;
    if (typeof mon !== 'object' || mon === null) continue;
    const voice = (mon as { voice?: unknown }).voice;
    if (typeof voice !== 'object' || voice === null) return undefined;
    const { lineageId, stage } = voice as { lineageId?: unknown; stage?: unknown };
    return typeof lineageId === 'string' && isStage(stage) ? { lineageId, stage } : undefined;
  }
  return undefined;
}
