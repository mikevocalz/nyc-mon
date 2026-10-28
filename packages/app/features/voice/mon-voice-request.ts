import { MAX_SPOKEN_TEXT } from '@acme/content/voice';
import type { MonMood } from '@acme/core';

/**
 * The app's call to `POST /v1/mon-voice` (packages/payload/src/admin/console/v1/mon-voice.ts):
 * one line in the active Mon's voice, authenticated by the Better Auth
 * session cookie (native fetch keeps it in the platform cookie jar; the web
 * app sends it cross-origin with `credentials: 'include'`).
 */

/** Why the server sent no clip (`x-mon-voice-reason`). */
export type MonVoiceSilenceReason = 'silent' | 'no-voice' | 'no-key';

/** The server has no clip for this line; the caption carries it. */
export class MonVoiceSilent extends Error {
  readonly reason: MonVoiceSilenceReason;
  constructor(reason: MonVoiceSilenceReason) {
    super(`mon voice: ${reason}`);
    this.name = 'MonVoiceSilent';
    this.reason = reason;
  }
}

export interface MonVoiceLineRequest {
  readonly monId: string;
  readonly text: string;
  readonly mood?: MonMood;
}

/** One clip: mp3 bytes and the pitch factor the player still has to apply (stage target / baked). */
export interface MonVoiceClipBytes {
  readonly bytes: ArrayBuffer;
  readonly pitch: number;
}

export interface MonVoiceRequestDeps {
  readonly baseUrl: string;
  /** Native sends `origin: nycmon://` (RN fetch sets none). */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
}

function readReason(value: string | null): MonVoiceSilenceReason {
  return value === 'no-key' || value === 'no-voice' ? value : 'silent';
}

function readFactor(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function requestMonVoice(line: MonVoiceLineRequest, signal: AbortSignal, deps: MonVoiceRequestDeps): Promise<MonVoiceClipBytes> {
  const res = await deps.fetch(`${deps.baseUrl}/v1/mon-voice`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'audio/mpeg', ...deps.headers },
    body: JSON.stringify({ monId: line.monId, text: line.text.slice(0, MAX_SPOKEN_TEXT), ...(line.mood === undefined ? {} : { mood: line.mood }) }),
    signal,
  });
  if (res.status === 204) throw new MonVoiceSilent(readReason(res.headers.get('x-mon-voice-reason')));
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`mon voice: HTTP ${res.status}`);
  }
  const bytes = await res.arrayBuffer();
  const pitch = readFactor(res.headers.get('x-mon-pitch-target')) / readFactor(res.headers.get('x-mon-pitch'));
  return { bytes, pitch };
}
