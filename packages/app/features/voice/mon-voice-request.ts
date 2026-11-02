import { MAX_SPOKEN_TEXT } from '@acme/content/voice';
import type { MonMood, VoiceStage } from '@acme/core';

/**
 * The app's call to `POST /v1/mon-voice` (packages/payload/src/admin/console/v1/mon-voice.ts):
 * one line in the active Mon's voice, authenticated by the Better Auth
 * session cookie (native fetch keeps it in the platform cookie jar; the web
 * app sends it cross-origin with `credentials: 'include'`).
 */

/** Why the server sent no clip (`x-mon-voice-reason`). */
export type MonVoiceSilenceReason = 'silent' | 'no-voice' | 'no-key';

/** The server has no clip for this line; the caption carries it (the server's, when it sent one). */
export class MonVoiceSilent extends Error {
  readonly reason: MonVoiceSilenceReason;
  readonly caption: string | undefined;
  constructor(reason: MonVoiceSilenceReason, caption?: string) {
    super(`mon voice: ${reason}`);
    this.name = 'MonVoiceSilent';
    this.reason = reason;
    this.caption = caption;
  }
}

/** Any other non-OK answer. A 404 for an Egg means the server has no Mon record for it yet. */
export class MonVoiceHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`mon voice: HTTP ${status}`);
    this.name = 'MonVoiceHttpError';
    this.status = status;
  }
}

/**
 * The line as the server gated it by its own clock (`x-mon-caption`,
 * encodeURIComponent of the caption). Undefined when absent or malformed.
 */
export function readServerCaption(headers: Headers): string | undefined {
  const raw = headers.get('x-mon-caption');
  if (raw === null || raw === '') return undefined;
  try {
    const caption = decodeURIComponent(raw).trim();
    return caption === '' ? undefined : caption;
  } catch {
    return undefined;
  }
}

/** The voice stage the server spoke at (`x-mon-voice-stage`), when it said. */
export function readServerVoiceStage(headers: Headers): VoiceStage | undefined {
  const raw = headers.get('x-mon-voice-stage');
  return raw === 'baby-talk' || raw === 'limited' || raw === 'full' ? raw : undefined;
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
  /** The caption the server gated the line to; it wins over the local one (the server clock decides). */
  readonly caption?: string;
  readonly voiceStage?: VoiceStage;
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
  if (res.status === 204) throw new MonVoiceSilent(readReason(res.headers.get('x-mon-voice-reason')), readServerCaption(res.headers));
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new MonVoiceHttpError(res.status);
  }
  const bytes = await res.arrayBuffer();
  const pitch = readFactor(res.headers.get('x-mon-pitch-target')) / readFactor(res.headers.get('x-mon-pitch'));
  const caption = readServerCaption(res.headers);
  const voiceStage = readServerVoiceStage(res.headers);
  return { bytes, pitch, ...(caption === undefined ? {} : { caption }), ...(voiceStage === undefined ? {} : { voiceStage }) };
}
