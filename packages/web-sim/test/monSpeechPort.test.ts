import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MonSpeechCue } from '@acme/ui/three/mon/lipsync';
import { monSpeechPort, ttsBody } from '../src/client/monSpeechPort.ts';
import type { MonVoice } from '../src/client/monVoice.ts';
import type { SpeakAsOptions } from '../src/client/speech.ts';

const voice: MonVoice = { lineageId: 'dex-001/male/1', stage: 'Baby' };
const egg: MonVoice = { lineageId: 'dex-001/male/1', stage: 'Egg' };
const tick = () => new Promise((r) => setTimeout(r, 0));

function harness(v: MonVoice | undefined = voice) {
  const listeners = new Set<(c: MonSpeechCue) => void>();
  const emit = (c: MonSpeechCue) => listeners.forEach((l) => l(c));
  const network: string[] = [];
  const fetchFn = vi.fn(async (_input: unknown, init?: RequestInit) => {
    network.push(String(init?.body));
    return new Response('{"audio":"","audioContentType":"audio/mpeg"}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  let cue = 0;
  const speakCalls: string[] = [];
  /** Stands in for speakAs: fetches through the injected fetchFn, then starts a clip. */
  const speak = vi.fn(async (text: string, vv: MonVoice | undefined, opts: SpeakAsOptions) => {
    speakCalls.push(text);
    if (vv) await opts.fetchFn!('/api/tts', { method: 'POST', body: ttsBody(text, vv) });
    emit({ kind: 'start', id: `c${++cue}`, elapsedMs: 0, durationMs: 1000, track: { kind: 'amplitude', fps: 60, values: [] } } as MonSpeechCue);
  });
  const stop = vi.fn(() => emit({ kind: 'stop', id: `c${cue}` }));
  const port = monSpeechPort({
    voice: () => v,
    fetchFn,
    speak,
    stop,
    onCue: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    synthesizerBusy: () => false,
  });
  return { port, emit, network, speak, speakCalls, stop, current: () => `c${cue}` };
}

afterEach(() => vi.unstubAllGlobals());

describe('monSpeechPort', () => {
  it('prefetches the line once and plays from the prefetched answer', async () => {
    vi.stubGlobal('Audio', class {});
    const h = harness();
    const abort = new AbortController();
    const line = await h.port.prepare('Hey, Callah.', abort.signal);
    expect(h.network).toEqual([ttsBody('Hey, Callah.', voice)]);
    const done = h.port.play(line, abort.signal);
    await tick();
    expect(h.network).toHaveLength(1); // no second request
    let finished = false;
    void done.then(() => (finished = true));
    await tick();
    expect(finished).toBe(false); // still speaking
    h.emit({ kind: 'stop', id: h.current() });
    await done;
  });

  it('resolves when the clip is cut off by a barge-in', async () => {
    vi.stubGlobal('Audio', class {});
    const h = harness();
    const abort = new AbortController();
    const line = await h.port.prepare('A long line about pizza.', abort.signal);
    const done = h.port.play(line, abort.signal);
    await tick();
    abort.abort();
    await done;
    expect(h.stop).toHaveBeenCalled();
  });

  it('an Egg is silent: nothing is fetched or played', async () => {
    vi.stubGlobal('Audio', class {});
    const h = harness(egg);
    const abort = new AbortController();
    const line = await h.port.prepare('…', abort.signal);
    await h.port.play(line, abort.signal);
    expect(h.network).toEqual([]);
    expect(h.speakCalls).toEqual([]);
  });

  it('a failed prefetch still plays: speakAs fetches for itself', async () => {
    vi.stubGlobal('Audio', class {});
    const h = harness();
    const abort = new AbortController();
    const failing = monSpeechPort({ voice: () => voice, fetchFn: (async () => { throw new Error('down'); }) as typeof fetch, speak: async (t, v, o) => { try { await h.speak(t, v, o); } catch { /* speakAs catches its own fetch errors */ } }, onCue: () => () => {}, synthesizerBusy: () => false, sleep: async () => {} });
    const line = await failing.prepare('Hi there friend.', abort.signal);
    expect(line.response).toBeNull();
    await failing.play(line, abort.signal);
    expect(h.speakCalls).toEqual(['Hi there friend.']);
  });
});
