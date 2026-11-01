import type { CallToolResult } from '@modelcontextprotocol/client';
import { describe, expect, it, vi } from 'vitest';
import { createCompanionVoice } from '../src/client/companionVoice.ts';
import type { Authorize } from '../src/client/freshToken.ts';
import type { MonVoice } from '../src/client/monVoice.ts';
import type { VoicePort } from '../src/client/speechQueue.ts';
import { babbleInventory } from '@acme/content/voice';
import { isBabble } from '@acme/core';

const result = (structuredContent: unknown): CallToolResult => ({ content: [], structuredContent }) as never;
const ratti = (stage = 'Baby', mood?: string) => result({ mon: { monId: 'mon-1', voice: { lineageId: 'dex-001/male/1', stage } }, ...(mood ? { mood } : {}) });

/** Records each sentence with the voice the port saw at prepare time; play resolves at once. */
function recordingPort(voice: () => MonVoice | undefined) {
  const prepared: { text: string; voice: MonVoice | undefined }[] = [];
  const signals: AbortSignal[] = [];
  const port: VoicePort<string> = {
    prepare: vi.fn(async (text: string, signal: AbortSignal) => {
      prepared.push({ text, voice: voice() });
      signals.push(signal);
      return text;
    }),
    play: vi.fn(async () => {}),
  };
  return { port, prepared, signals };
}

function setup() {
  const stopAll = vi.fn();
  const setSession = vi.fn();
  let rec!: ReturnType<typeof recordingPort>;
  const voice = createCompanionVoice({
    port: (current) => (rec = recordingPort(current)).port,
    stopAll,
    setSessionVoice: setSession,
  });
  return { voice, stopAll, setSession, rec: () => rec };
}

describe('the NVIDIA companion speaks in the Mon voice', () => {
  it('learns the voice from a tool result and speaks each sentence in it, without quote marks', async () => {
    const { voice, rec, setSession } = setup();
    voice.learn(ratti('Small', 'content'));
    const done = voice.speak('*yawns* Hey "Callah". I ate!');
    expect(await done).toBe('finished');
    expect(rec().prepared).toEqual([
      { text: '*yawns* Hey Callah.', voice: { lineageId: 'dex-001/male/1', stage: 'Small', mood: 'content' } },
      { text: 'I ate!', voice: { lineageId: 'dex-001/male/1', stage: 'Small', mood: 'content' } },
    ]);
    expect(setSession).toHaveBeenCalledWith({ lineageId: 'dex-001/male/1', stage: 'Small', mood: 'content' });
  });

  it('gates each sentence by the voice stage, so the caption shows what the voice says (Decision 32)', async () => {
    const { voice, rec } = setup();
    voice.learn(result({ mon: { monId: 'mon-1', hatchedAt: 5, voice: { lineageId: 'dex-001/male/1', stage: 'Egg', voiceStage: 'baby-talk' } } }));
    const captions: string[] = [];
    await voice.speak('Hello Callah, I love you.', undefined, (s) => captions.push(s));
    const inv = babbleInventory({ lineageId: 'dex-001/male/1' }, 'Egg');
    expect(rec().prepared).toHaveLength(1);
    expect(isBabble(rec().prepared[0]!.text, inv)).toBe(true);
    expect(captions).toEqual([rec().prepared[0]!.text]);
    expect(voice.current()?.voiceStage).toBe('baby-talk');
    expect(voice.hatchedAt()).toBe(5);
    voice.reset();
    expect(voice.hatchedAt()).toBeUndefined();
  });

  it('keeps the known hatch time when a later result omits it, and forgets it for another Mon', () => {
    const { voice } = setup();
    voice.learn(result({ mon: { monId: 'mon-1', hatchedAt: 5, voice: { lineageId: 'dex-001/male/1', stage: 'Baby' } } }));
    voice.learn(result({ mon: { monId: 'mon-1', voice: { lineageId: 'dex-001/male/1', stage: 'Baby' } } }));
    expect(voice.hatchedAt()).toBe(5);
    voice.learn(result({ mon: { monId: 'mon-2', voice: { lineageId: 'dex-008/female/2', stage: 'Baby' } } }));
    expect(voice.hatchedAt()).toBeUndefined();
  });

  it('keeps the voice when a later result names none (sticky)', async () => {
    const { voice, rec } = setup();
    voice.learn(ratti('Small'));
    voice.learn(result({ applied: true }));
    voice.learn(result({ mon: { monId: 'mon-1' } }));
    await voice.speak('Still me.');
    expect(rec().prepared[0]?.voice).toEqual({ lineageId: 'dex-001/male/1', stage: 'Small' });
  });

  it('moves with a newer result for the same Mon', async () => {
    const { voice, rec } = setup();
    voice.learn(ratti('Baby'));
    voice.learn(ratti('Small', 'asleep'));
    await voice.speak('Grown.');
    expect(rec().prepared[0]?.voice).toEqual({ lineageId: 'dex-001/male/1', stage: 'Small', mood: 'asleep' });
  });

  it('stop() cuts the reply off and silences the adapter', async () => {
    const { voice, rec, stopAll } = setup();
    voice.learn(ratti());
    const done = voice.speak('One. Two. Three.');
    voice.stop();
    expect(await done).toBe('cancelled');
    expect(rec().signals.every((s) => s.aborted)).toBe(true);
    expect(stopAll).toHaveBeenCalled();
  });

  it('a new reply cuts off the one still speaking', async () => {
    const { voice } = setup();
    const first = voice.speak('First reply.');
    const second = voice.speak('Second reply.');
    expect(await first).toBe('cancelled');
    expect(await second).toBe('finished');
  });

  it('reset() forgets the voice so the next account does not inherit it', async () => {
    const { voice, rec, setSession } = setup();
    voice.learn(ratti());
    voice.reset();
    expect(setSession).toHaveBeenLastCalledWith(undefined);
    await voice.speak('Who am I?');
    expect(rec().prepared[0]?.voice).toBeUndefined();
  });

  it('fetches with the sign-in the reply was spoken under', async () => {
    const seen: unknown[] = [];
    const voice = createCompanionVoice({
      port: (current, authorize) => {
        seen.push(authorize);
        return recordingPort(current).port;
      },
      stopAll: vi.fn(),
      setSessionVoice: vi.fn(),
    });
    const authorize: Authorize = (call) => call('tok');
    await voice.speak('Hi.', authorize);
    expect(seen).toEqual([authorize]);
  });

  it('says nothing for an empty reply', async () => {
    const { voice, rec } = setup();
    expect(await voice.speak('  \n ')).toBe('finished');
    expect(rec().prepared).toEqual([]);
  });
});

describe('barge-in on the NVIDIA companion voice', () => {
  it('fades the playing clip out before cancelling the queue, so the fade is not cut short', async () => {
    const order: string[] = [];
    let playSignal!: AbortSignal;
    const port: VoicePort<string> = {
      prepare: async (text) => text,
      play: (_clip, signal) => {
        playSignal = signal;
        return new Promise<void>((done) => signal.addEventListener('abort', () => { order.push('queue-cancelled'); done(); }));
      },
    };
    const voice = createCompanionVoice({
      port: () => port,
      stopAll: (opts) => { order.push(`fade:${opts?.fadeMs ?? 0}`); },
      setSessionVoice: () => {},
    });
    const done = voice.speak('First one here. Second one here.');
    await vi.waitFor(() => expect(playSignal).toBeDefined());
    order.length = 0; // speak() itself stops whatever spoke before
    voice.stop({ fadeMs: 60 });
    expect(await done).toBe('cancelled');
    expect(order).toEqual(['fade:60', 'queue-cancelled']);
  });

  it('reports each sentence as it starts, so captions never run ahead of the voice', async () => {
    const started: string[] = [];
    let release!: () => void;
    const port: VoicePort<string> = {
      prepare: async (text) => text,
      play: () => new Promise<void>((done) => (release = done)),
    };
    const voice = createCompanionVoice({ port: () => port, stopAll: () => {}, setSessionVoice: () => {} });
    const done = voice.speak('First one here. Second one here.', undefined, (s) => started.push(s));
    await vi.waitFor(() => expect(started).toEqual(['First one here.']));
    voice.stop();
    release();
    expect(await done).toBe('cancelled');
    expect(started).toEqual(['First one here.']);
  });
});

describe('the first reply after sign-in is in the Mon voice', () => {
  it('waits for the Mon voice loaded at connect before speaking a reply that came first', async () => {
    const { voice, rec } = setup();
    let loaded!: (r: CallToolResult) => void;
    voice.prime(() => new Promise<CallToolResult>((r) => (loaded = r)));
    const done = voice.speak('Hey Callah.');
    await new Promise((r) => setTimeout(r, 10));
    loaded(ratti('Baby'));
    expect(await done).toBe('finished');
    expect(rec().prepared[0]?.voice).toEqual({ lineageId: 'dex-001/male/1', stage: 'Baby' });
  });

  it('still speaks when loading the voice fails or hangs', async () => {
    const { voice, rec } = setup();
    voice.prime(async () => { throw new Error('offline'); });
    expect(await voice.speak('Hey.')).toBe('finished');
    expect(rec().prepared[0]?.voice).toBeUndefined();
    const hung = setup();
    hung.voice.prime(() => new Promise(() => {}), 20);
    expect(await hung.voice.speak('Hey.')).toBe('finished');
  });
});
