import { voicePitchFactor } from '@acme/content/voices';
import type { MonSpeechCue } from '@acme/ui/three/mon/lipsync';
import type { MonVoice } from './monVoice.ts';
import { speakAs, stopSpeaking, type SpeakAsOptions } from './speech.ts';
import { addSpeechCueListener } from './speechCues.ts';
import type { VoicePort } from './speechQueue.ts';

/**
 * The speech queue's voice, built around speech.ts's `speakAs`, which owns the
 * Mon's voice (ElevenLabs through /api/tts, lip-sync cues, the fallback).
 *
 * `prepare` fetches /api/tts for one sentence ahead of time and keeps the
 * whole answer in memory. `play` hands that answer to `speakAs` through its
 * `fetchFn` option, so playback starts without a network round trip, then
 * waits for the clip to end: the speech cue's stop for a voiced clip, the
 * synthesizer going quiet for Web Speech. If the request `speakAs` makes is
 * not the one prefetched (its body format changed), it fetches for real.
 */

export interface PreparedLine {
  readonly text: string;
  readonly voice: MonVoice | undefined;
  /** The exact JSON body prefetched, or null when nothing was. */
  readonly body: string | null;
  readonly response: Response | null;
}

export interface MonSpeechPortDeps {
  readonly voice: () => MonVoice | undefined;
  readonly getToken?: () => string | undefined;
  readonly endpoint?: string;
  readonly fetchFn?: typeof fetch;
  readonly speak?: (text: string, voice: MonVoice | undefined, opts: SpeakAsOptions) => Promise<void>;
  readonly stop?: () => void;
  readonly onCue?: (listener: (cue: MonSpeechCue) => void) => () => void;
  /** Web Speech is talking or has an utterance queued. */
  readonly synthesizerBusy?: () => boolean;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** The body speech.ts sends for one line; kept identical so the prefetch is reused. */
export function ttsBody(text: string, voice: MonVoice): string {
  return JSON.stringify({
    text: text.slice(0, 400),
    lineageId: voice.lineageId,
    stage: voice.stage,
    ...(voice.mood === undefined ? {} : { mood: voice.mood }),
  });
}

function defaultSynthBusy(): boolean {
  const s = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  return !!s && (s.speaking || s.pending);
}

/** Rough speaking time, a last guard when no cue arrives: ~15 characters a second. */
function estimateMs(text: string): number {
  return Math.min(30_000, 600 + text.length * 70);
}

export function monSpeechPort(deps: MonSpeechPortDeps): VoicePort<PreparedLine> {
  const fetchFn = deps.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const speak = deps.speak ?? speakAs;
  const stop = deps.stop ?? stopSpeaking;
  const onCue = deps.onCue ?? addSpeechCueListener;
  const synthBusy = deps.synthesizerBusy ?? defaultSynthBusy;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const endpoint = deps.endpoint ?? '/api/tts';

  return {
    async prepare(text, signal) {
      const voice = deps.voice();
      const silent = voice !== undefined && voicePitchFactor(voice.stage) === null;
      if (voice === undefined || silent || typeof Audio === 'undefined') return { text, voice, body: null, response: null };
      const body = ttsBody(text, voice);
      try {
        const token = deps.getToken?.();
        const res = await fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, audio/mpeg',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body,
          signal,
        });
        // Read the whole answer now, so playing it later costs no network time.
        const bytes = res.status === 200 ? await res.arrayBuffer() : null;
        const response = new Response(bytes, { status: res.status, headers: res.headers });
        return { text, voice, body, response };
      } catch (err) {
        if (signal.aborted) throw err;
        // speakAs will try again and fall back on its own.
        return { text, voice, body: null, response: null };
      }
    },

    async play(line, signal) {
      if (signal.aborted) return;
      if (line.voice !== undefined && voicePitchFactor(line.voice.stage) === null) return; // an Egg is silent
      let started: string | null = null;
      let endedId: string | null = null;
      let wake: (() => void) | null = null;
      const unsubscribe = onCue((cue) => {
        if (cue.kind === 'start') started = cue.id;
        else if (cue.id === started || started === null) endedId = cue.id;
        wake?.();
      });
      const onAbort = () => {
        stop();
        wake?.();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        let prefetched = line.response;
        await speak(line.text, line.voice, {
          ...(deps.getToken ? { getToken: deps.getToken } : {}),
          endpoint,
          fetchFn: ((input: RequestInfo | URL, init?: RequestInit) => {
            if (prefetched && init?.body === line.body) {
              const r = prefetched;
              prefetched = null;
              return Promise.resolve(r);
            }
            return fetchFn(input, init);
          }) as typeof fetch,
        });
        if (signal.aborted) return;
        if (started !== null) {
          // A voiced clip: its stop cue marks the end (or the cut-off).
          const deadline = Date.now() + estimateMs(line.text) * 2;
          while (endedId !== started && !signal.aborted && Date.now() < deadline) {
            await Promise.race([new Promise<void>((r) => (wake = r)), sleep(250)]);
          }
          return;
        }
        // Web Speech, or a clip with no timing: wait for the synthesizer, or the estimate.
        const until = Date.now() + estimateMs(line.text);
        if (synthBusy()) {
          const cap = Date.now() + estimateMs(line.text) * 2;
          while (synthBusy() && !signal.aborted && Date.now() < cap) await sleep(100);
          return;
        }
        if (line.response?.status === 200) while (!signal.aborted && Date.now() < until && started === null) await sleep(100);
      } finally {
        unsubscribe();
        signal.removeEventListener('abort', onAbort);
      }
    },
  };
}
