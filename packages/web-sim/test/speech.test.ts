import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MonSpeechCue } from '@acme/ui/three/mon/lipsync';
import { speakAs, stopSpeaking } from '../src/client/speech.ts';
import { addSpeechCueListener } from '../src/client/speechCues.ts';

/** Records what speakAs does to the element; Node has no HTMLAudioElement. */
class FakeAudio {
  static created: FakeAudio[] = [];
  playbackRate = 1;
  preservesPitch = true;
  onended: (() => void) | null = null;
  constructor(readonly src: string) {
    FakeAudio.created.push(this);
  }
  currentTime = 0.03;
  duration = 1.5;
  play = vi.fn(async () => {});
  pause = vi.fn();
}

/** A fetch stand-in that records each request's init. */
function fakeFetch(respond: () => Response) {
  const inits: RequestInit[] = [];
  const fn = (async (_input: unknown, init?: RequestInit) => {
    inits.push(init ?? {});
    return respond();
  }) as typeof fetch;
  return { fn, inits };
}

const mp3 = () => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });

afterEach(() => {
  stopSpeaking();
  FakeAudio.created = [];
  vi.unstubAllGlobals();
});

describe('speakAs', () => {
  it('plays server audio at rate 1 with pitch preserved for every speaking stage', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    for (const stage of ['Baby', 'Small', 'Mid', 'Max'] as const) {
      const { fn } = fakeFetch(mp3);
      await speakAs('hello', { lineageId: 'dex-001/female/1', stage }, { fetchFn: fn, endpoint: '/api/tts' });
      const audio = FakeAudio.created.at(-1);
      expect(audio?.play).toHaveBeenCalledTimes(1);
      expect(audio?.playbackRate).toBe(1);
      expect(audio?.preservesPitch).toBe(true);
    }
  });

  it('sends the mood when the voice has one and leaves it out when not', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { fn, inits } = fakeFetch(mp3);
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Small', mood: 'needs-social' }, { fetchFn: fn });
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Small' }, { fetchFn: fn });
    const bodies = inits.map((init) => JSON.parse(String(init.body)) as unknown);
    expect(bodies[0]).toEqual({ text: 'hi', lineageId: 'dex-001/male/2', stage: 'Small', mood: 'needs-social' });
    expect(bodies[1]).toEqual({ text: 'hi', lineageId: 'dex-001/male/2', stage: 'Small' });
  });

  it('keeps an Egg silent without calling the server', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { fn, inits } = fakeFetch(mp3);
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Egg', mood: 'content' }, { fetchFn: fn });
    expect(inits).toHaveLength(0);
    expect(FakeAudio.created).toHaveLength(0);
  });

  it('falls back to Web Speech with the stage pitch on 204, leaving the rate alone', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const spoken: { pitch: number; rate: number }[] = [];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: (u: Utterance) => spoken.push({ pitch: u.pitch, rate: u.rate }) });
    const { fn } = fakeFetch(() => new Response(null, { status: 204 }));
    await speakAs('hi', { lineageId: 'dex-001/male/2', stage: 'Baby' }, { fetchFn: fn });
    expect(spoken).toEqual([{ pitch: 1.3, rate: 1.02 }]);
    expect(FakeAudio.created).toHaveLength(0);
  });
});

describe('speakAs lip-sync cues', () => {
  const alignment = { characters: [...'Hi mom'], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] };
  const performance = (extra: Record<string, unknown>) => () =>
    new Response(JSON.stringify({ audio: 'AQID', audioContentType: 'audio/mpeg', ...extra }), { status: 200, headers: { 'content-type': 'application/json' } });
  const listen = () => {
    const cues: MonSpeechCue[] = [];
    const off = addSpeechCueListener((c) => cues.push(c));
    return { cues, off };
  };

  it('asks for JSON and cues the face when the server sent Audio2Face frames', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { cues, off } = listen();
    const { fn, inits } = fakeFetch(performance({ alignment, face: { fps: 30, names: ['jawOpen'], frames: [[0.1], [0.3]] } }));
    await speakAs('Hi mom', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fn });
    expect(new Headers(inits[0]?.headers).get('accept')).toBe('application/json, audio/mpeg');
    expect(cues).toHaveLength(1);
    const start = cues[0]!;
    expect(start.kind).toBe('start');
    if (start.kind !== 'start') return;
    expect(start.track.kind).toBe('face');
    expect(start.elapsedMs).toBeCloseTo(30);
    expect(start.durationMs).toBeCloseTo(1500);
    stopSpeaking();
    expect(cues.at(-1)).toEqual({ kind: 'stop', id: start.id });
    off();
  });

  it('falls back to character-timed visemes without a face, and to nothing (no cue) without any timing', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const { cues, off } = listen();
    await speakAs('Hi mom', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fakeFetch(performance({ alignment })).fn });
    expect(cues[0]?.kind === 'start' && cues[0].track.kind).toBe('visemes');
    stopSpeaking();
    cues.length = 0;
    // Plain mp3 and no WebAudio in Node: no source, so no cue; the clip still plays.
    await speakAs('Hi', { lineageId: 'dex-001/male/2', stage: 'Mid' }, { fetchFn: fakeFetch(mp3).fn });
    expect(cues).toEqual([]);
    expect(FakeAudio.created.at(-1)?.play).toHaveBeenCalledTimes(1);
    off();
  });
});
