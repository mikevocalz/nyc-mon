import type { KeyValueStore } from '../shared/auth.ts';
import { currentMonVoice, type MonVoice } from './monVoice.ts';
import type { TranscriptItem } from './session.ts';

/**
 * The Mon speaks in one voice for the whole conversation. Once a tool result
 * has told us the voice, it sticks: a reply before any tool result this turn
 * (or after a reload) uses the remembered voice, never a fallback one.
 *
 * The voice is remembered per Mon (`monId`). A newer result for the same Mon
 * may move its stage or mood; a result for a different Mon replaces it.
 */

export interface RememberedVoice {
  readonly monId: string;
  readonly voice: MonVoice;
}

const KEY = 'nyc-mon-sim.voice.v1';

/** The Mon voice the latest tool results report, with the Mon it belongs to. */
export function latestMonVoice(items: readonly TranscriptItem[]): RememberedVoice | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item?.kind !== 'tool') continue;
    const mon = (item.result.structuredContent as { mon?: unknown } | undefined)?.mon;
    if (typeof mon !== 'object' || mon === null) continue;
    const monId = (mon as { monId?: unknown }).monId;
    const voice = currentMonVoice([item]);
    if (typeof monId !== 'string' || monId === '') return null;
    return voice ? { monId, voice } : null;
  }
  return null;
}

/**
 * The voice for the next reply. The newest result wins when it names a voice.
 * When it names none (the Mon was hatched before voice lineages, or the result
 * was malformed) the remembered voice stays, so the Mon never switches voices
 * mid-conversation.
 */
export function stickyVoice(remembered: RememberedVoice | null, items: readonly TranscriptItem[]): RememberedVoice | null {
  return latestMonVoice(items) ?? remembered;
}

export function sameVoice(a: RememberedVoice | null, b: RememberedVoice | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.monId === b.monId && a.voice.lineageId === b.voice.lineageId && a.voice.stage === b.voice.stage && a.voice.mood === b.voice.mood;
}

function isRemembered(v: unknown): v is RememberedVoice {
  if (typeof v !== 'object' || v === null) return false;
  const { monId, voice } = v as { monId?: unknown; voice?: unknown };
  if (typeof monId !== 'string' || typeof voice !== 'object' || voice === null) return false;
  // Re-validate through the same reader the tool results go through.
  const item = { kind: 'tool', result: { content: [], structuredContent: { mon: { monId, voice }, mood: (voice as { mood?: unknown }).mood } } } as unknown as TranscriptItem;
  return currentMonVoice([item]) !== undefined;
}

export function loadVoice(store: KeyValueStore | null): RememberedVoice | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRemembered(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveVoice(store: KeyValueStore | null, v: RememberedVoice | null): void {
  try {
    if (v) store?.setItem(KEY, JSON.stringify(v));
    else store?.removeItem(KEY);
  } catch {
    /* storage blocked: the voice lasts as long as the tab */
  }
}
