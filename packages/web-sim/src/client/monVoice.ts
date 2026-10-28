import { type MonVoiceRef, readMonVoiceRef } from '@acme/content/voice';
import type { TranscriptItem } from './session.ts';

/** The voice a Mon speaks with, as the MCP tools report it in `mon.voice` (`@acme/content/voice`). */
export type MonVoice = MonVoiceRef;

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
    return readMonVoiceRef((mon as { voice?: unknown }).voice, structured?.mood);
  }
  return undefined;
}
